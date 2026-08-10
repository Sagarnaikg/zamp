import { describe, expect, it } from "vitest";
import { PIPELINE_STAGES, PipelineTrace } from "./trace";

describe("PipelineTrace", () => {
  it("records stages in the order they ran", () => {
    const trace = new PipelineTrace();
    trace.ok("store", trace.begin(), { detail: "saved" });
    trace.ok("detect", trace.begin(), { detail: "digital pdf" });
    expect(trace.toJSON().map((s) => s.key)).toEqual(["store", "detect"]);
  });

  it("labels stages from the canonical list so the UI doesn't have to", () => {
    const trace = new PipelineTrace();
    trace.ok("second_reading", trace.begin(), { detail: "ran" });
    expect(trace.toJSON()[0].label).toBe("Second reading");
  });

  it("keeps a skipped stage in the trace, with its reason", () => {
    // A skipped stage is the interesting part of the graph — the user should
    // see the pipeline chose not to spend, and why.
    const trace = new PipelineTrace();
    trace.skipped("second_reading", "arithmetic already reconciles");
    const [stage] = trace.toJSON();
    expect(stage.status).toBe("skipped");
    expect(stage.detail).toBe("arithmetic already reconciles");
  });

  it("carries the model and token cost of the stages that called one", () => {
    const trace = new PipelineTrace();
    trace.ok("extract", trace.begin(), {
      detail: "read the document",
      provider: "google",
      model: "gemini-flash-latest",
      usage: { input: 900, output: 100, total: 1000, calls: 1 },
    });
    const [stage] = trace.toJSON();
    expect(stage.provider).toBe("google");
    expect(stage.model).toBe("gemini-flash-latest");
    expect(stage.usage?.total).toBe(1000);
  });

  it("totals only the stages that actually spent tokens", () => {
    const trace = new PipelineTrace();
    trace.ok("extract", trace.begin(), {
      detail: "",
      usage: { input: 900, output: 100, total: 1000, calls: 1 },
    });
    trace.skipped("second_reading", "not needed");
    trace.ok("score", trace.begin(), { detail: "" });
    const summary = trace.summary();
    expect(summary.calls).toBe(1);
    expect(summary.tokens).toBe(1000);
  });

  it("records a failure without losing the stages that already succeeded", () => {
    const trace = new PipelineTrace();
    trace.ok("store", trace.begin(), { detail: "saved" });
    trace.failed("extract", trace.begin(), "provider rate limited");
    expect(trace.toJSON().map((s) => s.status)).toEqual(["ok", "failed"]);
    expect(trace.toJSON()[1].detail).toBe("provider rate limited");
  });

  it("exposes every stage the pipeline can run, including skippable ones", () => {
    // The UI draws the full pipeline and greys out what didn't run, so this
    // list must stay complete.
    const keys = PIPELINE_STAGES.map((s) => s.key);
    for (const expected of [
      "store",
      "detect",
      "extract",
      "validate",
      "second_reading",
      "compare",
      "tiebreak",
      "duplicates",
      "score",
    ]) {
      expect(keys).toContain(expected);
    }
  });
});
