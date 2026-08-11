import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/server/db";
import { documents, extractions, lineItems, type TokenUsage } from "@/server/db/schema";
import { getStorage } from "@/server/storage";
import { detectFileKind } from "@/server/ingest/detect";
import { PipelineTrace } from "@/server/ingest/trace";
import {
  extract,
  extractFocused,
  type Extraction,
} from "@/server/llm/extraction";
import { classifyLlmError } from "@/server/llm/errors";
import { addUsage, emptyUsage } from "@/server/llm/usage";
import {
  computeConfidence,
  type ConfidenceResult,
} from "@/server/confidence/engine";
import { needsSecondReading } from "@/server/confidence/policy";
import type { DuplicateCandidate } from "@/server/confidence/types";
import {
  CONFIDENCE,
  DocumentStatus,
  FILE_KIND_DETAILS,
  FileKind,
  LLM_ERROR_MESSAGES,
  PIPELINE_DETAILS,
  PipelineStageKey,
  Provider,
  REVIEW_THRESHOLD,
} from "@/server/constants";

/**
 * Document ingestion (decisions.md §8, §20, §21).
 *
 * The pipeline runs cheap, certain checks before expensive, uncertain ones,
 * and records what it did at every step:
 *
 *   store → detect → first reading → validate ─┬→ second reading → compare → tiebreak ─┬→ score
 *                                              └→ duplicate check ─────────────────────┘
 */

// ---------------------------------------------------------------------------
// Model calls that are allowed to fail
// ---------------------------------------------------------------------------

/**
 * Independent second reading for the agreement signal — a different provider
 * when one is configured, else the same provider on a different model tier
 * and input modality (decisions.md §8). A failure degrades to the remaining
 * signals rather than failing ingestion.
 */
async function secondOpinion(
  kind: FileKind,
  file: { data: Buffer; mimeType: string; text?: string; filename?: string },
  primaryProvider: Provider,
) {
  try {
    return await extract(kind, file, {
      secondOpinion: true,
      avoid: primaryProvider,
    });
  } catch {
    return null;
  }
}

/**
 * Third, focused reading of only the disputed fields. Also allowed to fail:
 * the dispute simply stays flagged for a human instead of being resolved.
 */
async function focusedRecheck(
  fields: readonly string[],
  file: { data: Buffer; mimeType: string; filename?: string },
  primaryProvider: Provider,
) {
  try {
    return await extractFocused(fields, file, {
      avoid: primaryProvider,
    });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Verification — deciding how much scrutiny this document needs
// ---------------------------------------------------------------------------

/** Existing workspace documents to compare against for duplicate detection. */
async function duplicateCandidates(
  workspaceId: string,
  excludeDocumentId: string,
): Promise<DuplicateCandidate[]> {
  return db
    .select({
      documentId: extractions.documentId,
      invoiceNumber: extractions.invoiceNumber,
      vendor: extractions.vendor,
      total: extractions.total,
      docDate: extractions.docDate,
      filename: documents.filename,
      status: documents.status,
    })
    .from(extractions)
    .innerJoin(documents, eq(extractions.documentId, documents.id))
    .where(
      and(
        eq(extractions.workspaceId, workspaceId),
        ne(extractions.documentId, excludeDocumentId),
        inArray(documents.status, [DocumentStatus.NeedsReview, DocumentStatus.Accepted]),
      ),
    );
}

function describeValidation(confidence: ConfidenceResult): string {
  const meta = Object.values(confidence.fieldMeta);
  const corroborated = meta.filter(
    (m) => m!.confidence >= CONFIDENCE.verified,
  ).length;
  const contradicted = meta.filter(
    (m) => m!.confidence < REVIEW_THRESHOLD,
  ).length;
  return PIPELINE_DETAILS.validated(corroborated, contradicted);
}

interface VerificationInput {
  workspaceId: string;
  documentId: string;
  kind: FileKind;
  extraction: Extraction;
  provider: Provider;
  file: { data: Buffer; mimeType: string; text?: string; filename?: string };
  trace: PipelineTrace;
}

/**
 * Escalating verification: deterministic checks, then a second reading only
 * if those leave doubt, then a focused re-read only of fields the two
 * readings disagree on. Each rung is more expensive than the last, so each
 * one has to be justified by the previous rung's result.
 */
async function verifyExtraction({
  workspaceId,
  documentId,
  kind,
  extraction,
  provider,
  file,
  trace,
}: VerificationInput): Promise<{
  confidence: ConfidenceResult;
  usage: TokenUsage;
}> {
  let usage = emptyUsage();

  let t = trace.begin();
  const candidates = await duplicateCandidates(workspaceId, documentId);
  let confidence = computeConfidence({
    extraction,
    duplicateCandidates: candidates,
  });
  trace.ok(PipelineStageKey.Validate, t, { detail: describeValidation(confidence) });

  // Rung 2: a second independent reading, if the cheap checks left doubt.
  let second: Extraction | null = null;
  if (needsSecondReading(kind, confidence)) {
    t = trace.begin();
    const reading = await secondOpinion(kind, file, provider);
    if (reading) {
      second = reading.extraction;
      usage = addUsage(usage, reading.usage);
      confidence = computeConfidence({
        extraction,
        secondOpinion: second,
        duplicateCandidates: candidates,
      });
      trace.ok(PipelineStageKey.SecondReading, t, {
        detail:
          reading.provider === provider
            ? PIPELINE_DETAILS.secondReadingSameProvider
            : PIPELINE_DETAILS.secondReadingCrossProvider(reading.provider),
        provider: reading.provider,
        model: reading.modelId,
        usage: reading.usage,
      });
    } else {
      trace.failed(
        PipelineStageKey.SecondReading,
        t,
        PIPELINE_DETAILS.secondReadingFailed,
      );
    }
  } else {
    trace.skipped(
      PipelineStageKey.SecondReading,
      PIPELINE_DETAILS.secondReadingSkipped,
    );
  }

  if (second) {
    trace.ok(PipelineStageKey.Compare, trace.begin(), {
      detail:
        confidence.disputedFields.length === 0
          ? PIPELINE_DETAILS.readingsAgree
          : PIPELINE_DETAILS.readingsDisagree(
              confidence.disputedFields.join(", "),
            ),
    });
  } else {
    trace.skipped(PipelineStageKey.Compare, PIPELINE_DETAILS.compareSkipped);
  }

  // Rung 3: re-read just the disputed fields and let majority voting settle
  // them, so a human is only asked about what three readings couldn't agree on.
  const disputed = [...confidence.disputedFields];
  if (second && disputed.length > 0) {
    t = trace.begin();
    const tiebreak = await focusedRecheck(disputed, file, provider);
    if (tiebreak) {
      usage = addUsage(usage, tiebreak.usage);
      confidence = computeConfidence({
        extraction,
        secondOpinion: second,
        tiebreak: tiebreak.fields,
        duplicateCandidates: candidates,
      });
      const corrected = Object.keys(confidence.corrections);
      const fields = disputed.join(", ");
      const tiebreakDetail =
        corrected.length > 0
          ? PIPELINE_DETAILS.tiebreakCorrected(fields, corrected.join(", "))
          : PIPELINE_DETAILS.tiebreakKept(fields);
      trace.ok(PipelineStageKey.Tiebreak, t, {
        detail: tiebreakDetail,
        usage: tiebreak.usage,
      });
    } else {
      trace.failed(PipelineStageKey.Tiebreak, t, PIPELINE_DETAILS.tiebreakFailed);
    }
  } else {
    trace.skipped(
      PipelineStageKey.Tiebreak,
      second
        ? PIPELINE_DETAILS.tiebreakNotNeeded
        : PIPELINE_DETAILS.tiebreakNotApplicable,
    );
  }

  trace.ok(PipelineStageKey.Duplicates, trace.begin(), {
    detail: confidence.matchedDuplicateId
      ? PIPELINE_DETAILS.duplicateFound
      : PIPELINE_DETAILS.duplicateNone(candidates.length),
  });

  trace.ok(PipelineStageKey.Score, trace.begin(), {
    detail:
      confidence.flaggedCount === 0
        ? PIPELINE_DETAILS.scoreClean
        : PIPELINE_DETAILS.scoreFlagged(confidence.flaggedCount),
  });

  return { confidence, usage };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/**
 * Write the extraction and its line items. Upserts rather than inserts,
 * because a retry re-extracts a document that already has rows.
 */
async function persistExtraction(
  workspaceId: string,
  documentId: string,
  extraction: Extraction,
  confidence: ConfidenceResult,
  usage: TokenUsage,
): Promise<void> {
  // Majority voting may have overruled the first reading on a field.
  const resolved = { ...extraction, ...confidence.corrections } as Extraction;

  const row = {
    documentId,
    workspaceId,
    vendor: resolved.vendor,
    invoiceNumber: resolved.invoice_number,
    docDate: resolved.doc_date,
    currency: resolved.currency,
    subtotal: resolved.subtotal?.toString() ?? null,
    tax: resolved.tax?.toString() ?? null,
    total: resolved.total?.toString() ?? null,
    category: resolved.category,
    extraFields: extraction.extra_fields,
    fieldMeta: confidence.fieldMeta,
    usage,
  };
  await db
    .insert(extractions)
    .values(row)
    .onConflictDoUpdate({
      target: extractions.documentId,
      set: { ...row, updatedAt: new Date() },
    });

  await db.delete(lineItems).where(eq(lineItems.documentId, documentId));
  if (extraction.line_items.length > 0) {
    await db.insert(lineItems).values(
      extraction.line_items.map((item, i) => ({
        documentId,
        workspaceId,
        position: i,
        description: item.description,
        quantity: item.quantity?.toString() ?? null,
        unitPrice: item.unit_price?.toString() ?? null,
        amount: item.amount?.toString() ?? null,
      })),
    );
  }
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

/**
 * Detect → read → verify → persist, for a document whose file is already
 * stored. Shared by upload and retry, so a transient provider failure never
 * costs the user a re-upload.
 */
async function processDocument(
  workspaceId: string,
  documentId: string,
  file: { type: string; data: Buffer; name: string },
) {
  const trace = new PipelineTrace();
  const storageTarget = process.env.BLOB_READ_WRITE_TOKEN
    ? PIPELINE_DETAILS.storageBlob
    : PIPELINE_DETAILS.storageDisk;
  trace.ok(PipelineStageKey.Store, trace.begin(), {
    detail: PIPELINE_DETAILS.stored(
      file.name,
      (file.data.length / 1024).toFixed(0),
      storageTarget,
    ),
  });

  try {
    let t = trace.begin();
    const { kind, text } = await detectFileKind(file.data, file.type);
    trace.ok(PipelineStageKey.Detect, t, { detail: FILE_KIND_DETAILS[kind] });
    await db
      .update(documents)
      .set({
        fileKind: kind,
        status: DocumentStatus.Processing,
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId));

    const fileInput = {
      data: file.data,
      mimeType: file.type,
      text,
      filename: file.name,
    };

    t = trace.begin();
    const result = await extract(kind, fileInput);
    if (!result) throw new Error(LLM_ERROR_MESSAGES.noExtractionResult);
    trace.ok(PipelineStageKey.Extract, t, {
      detail:
        kind === FileKind.DigitalPdf
          ? PIPELINE_DETAILS.readTextLayer
          : PIPELINE_DETAILS.readVisually,
      provider: result.provider,
      model: result.modelId,
      usage: result.usage,
    });

    const { confidence, usage } = await verifyExtraction({
      workspaceId,
      documentId,
      kind,
      extraction: result.extraction,
      provider: result.provider,
      file: fileInput,
      trace,
    });

    await persistExtraction(
      workspaceId,
      documentId,
      result.extraction,
      confidence,
      addUsage(result.usage, usage),
    );

    const [updated] = await db
      .update(documents)
      .set({
        status: DocumentStatus.NeedsReview,
        pipeline: trace.toJSON(),
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId))
      .returning();
    return { document: updated };
  } catch (err) {
    const { message, retryable, kind } = classifyLlmError(err);
    trace.failed(PipelineStageKey.Score, trace.begin(), message);
    const [failed] = await db
      .update(documents)
      .set({
        status: DocumentStatus.Failed,
        error: message,
        pipeline: trace.toJSON(),
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId))
      .returning();
    return { document: failed, error: message, retryable, errorKind: kind };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function listDocuments(workspaceId: string) {
  return db.query.documents.findMany({
    where: eq(documents.workspaceId, workspaceId),
    orderBy: [desc(documents.createdAt)],
    // The pipeline trace is a per-document diagnostic view, fetched on demand
    // from its own endpoint — one per row would dominate this response.
    columns: { pipeline: false },
  });
}

/** Store an uploaded file, then run it through the pipeline. */
export async function ingestDocument(
  workspaceId: string,
  file: { name: string; type: string; data: Buffer },
) {
  const storageKey = `${workspaceId}/${randomUUID()}-${file.name}`;
  const storagePath = await getStorage().put(storageKey, file.data, file.type);

  const [doc] = await db
    .insert(documents)
    .values({
      workspaceId,
      filename: file.name,
      mimeType: file.type,
      storagePath,
      status: DocumentStatus.Processing,
    })
    .returning();

  return processDocument(workspaceId, doc.id, {
    type: file.type,
    data: file.data,
    name: file.name,
  });
}

/**
 * Re-run the pipeline on a stored document. The file is already in storage,
 * so a rate limit or provider blip costs one click, not a re-upload.
 */
export async function retryDocument(workspaceId: string, documentId: string) {
  const doc = await db.query.documents.findFirst({
    where: and(
      eq(documents.id, documentId),
      eq(documents.workspaceId, workspaceId),
    ),
    columns: { id: true, mimeType: true, filename: true, storagePath: true },
  });
  if (!doc) return null;

  const data = await getStorage().get(doc.storagePath);
  return processDocument(workspaceId, doc.id, {
    type: doc.mimeType,
    data,
    name: doc.filename,
  });
}
