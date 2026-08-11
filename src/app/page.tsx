import Link from "next/link";
import { ArrowRight, ScanLine, ShieldCheck, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/constants";

const PILLARS = [
  {
    icon: ScanLine,
    title: "Read anything",
    body: "Digital PDFs go through their text layer; scans and phone photos go to a vision model.",
  },
  {
    icon: ShieldCheck,
    title: "Checked, not guessed",
    body: "Arithmetic, format, cross-reading and duplicate checks score every field independently.",
  },
  {
    icon: Sparkles,
    title: "Ask in English",
    body: "Query the accepted ledger in plain language — the answer shows the filters it actually ran.",
  },
];

export default function Home() {
  return (
    <div className="py-6">
      <div className="max-w-2xl px-1">
        <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-5xl">
          Turn messy documents into data you can trust
        </h1>
        <p className="mt-5 text-base leading-7 text-muted">
          Upload an invoice or receipt. It gets read, checked against its own
          arithmetic, cross-read when that&apos;s worth paying for, and scored field
          by field — so you know which numbers to look at, and which you can leave
          alone.
        </p>
        <Link
          href={ROUTES.documents}
          className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Upload a document
          <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
        </Link>
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-3">
        {PILLARS.map(({ icon: Icon, title, body }) => (
          <Card key={title} className="p-6">
            <span className="inline-flex size-11 items-center justify-center rounded-full bg-surface-raised text-foreground">
              <Icon className="size-5" strokeWidth={1.75} aria-hidden />
            </span>
            <h2 className="mt-5 text-sm font-semibold text-foreground">{title}</h2>
            <p className="mt-2 text-[13px] leading-6 text-muted">{body}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
