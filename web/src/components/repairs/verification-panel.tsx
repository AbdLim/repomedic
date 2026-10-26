"use client";

import type { Repair, TestExecution } from "@/types/repair";
import { Check, ChevronDown, ChevronUp, Clipboard } from "lucide-react";
import { useState } from "react";

type TestKind = "baseline" | "regression" | "suite";

type Props = {
  kind: TestKind;
  result: TestExecution | null;
};

function outcome(
  kind: TestKind,
  result: TestExecution | null,
): {
  label: string;
  color: string;
} {
  if (!result) return { label: "Not available", color: "text-slate-400" };
  if (result.timedOut) return { label: "Timed out", color: "text-amber-300" };
  if (result.exitCode === null)
    return { label: "Outcome unknown", color: "text-slate-400" };
  if (kind === "baseline") {
    return result.exitCode !== 0
      ? { label: "Failed as expected", color: "text-amber-300" }
      : { label: "Passed — bug not reproduced", color: "text-amber-300" };
  }
  return result.exitCode === 0
    ? { label: "Passed", color: "text-emerald-300" }
    : { label: "Failed", color: "text-rose-300" };
}

function testSummary(output: string): string | null {
  // Show the final recognizable pytest total when available; do not fabricate counts.
  const lines = output.split("\n").map((line) => line.trim());
  const summary = [...lines]
    .reverse()
    .find(
      (line) =>
        /\b\d+ (?:passed|failed|error|errors|skipped)\b/.test(line) &&
        /\bin \d+(?:\.\d+)?s\b/.test(line),
    );
  return summary?.replace(/^=+\s*|\s*=+$/g, "").trim() ?? null;
}

export function TestResultCard({ kind, result }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const { label, color } = outcome(kind, result);
  const title =
    kind === "baseline"
      ? "Baseline · before patch"
      : kind === "regression"
        ? "Regression · after patch"
        : "Existing test suite · after patch";
  const description =
    kind === "baseline"
      ? "The regression should fail against the original code to demonstrate the bug."
      : kind === "regression"
        ? "The regression should pass with the proposed change."
        : "The existing tests should pass with the proposed change.";
  const summary = result ? testSummary(result.output) : null;

  async function copyOutput() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.output);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article className="rounded-lg border border-[#29313c] bg-[#111720]">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div>
          <h3 className="font-medium">{title}</h3>
          <p className="muted mt-1 text-xs">{description}</p>
          {summary && (
            <p className="code mt-3 text-xs text-slate-300">{summary}</p>
          )}
        </div>
        <div className="text-right text-xs">
          <p className={`font-semibold ${color}`}>{label}</p>
          <p className="muted code mt-2">Exit: {result?.exitCode ?? "N/A"}</p>
        </div>
      </div>
      {result && (
        <div className="border-t border-[#29313c]">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 text-xs text-[#b7a4ff] hover:underline"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {expanded ? "Hide test output" : "View test output"}
            </button>
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={copyOutput}
              disabled={!result.output}
            >
              {copied ? <Check size={14} /> : <Clipboard size={14} />}
              {copied ? "Copied" : "Copy output"}
            </button>
          </div>
          {expanded && (
            <pre className="code max-h-105 overflow-auto border-t border-[#29313c] bg-[#0b1017] p-5 text-xs leading-5 text-slate-300">
              <code>{result.output || "No output was recorded."}</code>
            </pre>
          )}
        </div>
      )}
    </article>
  );
}

export function VerificationPanel({ repair }: { repair: Repair }) {
  const report = repair.report;
  const verified = repair.verification === "verified";
  const outcomeText = repair.verification ?? "Not yet determined";
  return (
    <section className="panel space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Verification evidence</h2>
          <p className="muted mt-1 text-xs">
            Evidence from the isolated repair run, not tests run in this
            browser.
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${
            verified
              ? "border-emerald-500/40 text-emerald-300"
              : "border-amber-500/40 text-amber-300"
          }`}
        >
          {outcomeText}
        </span>
      </div>
      {!report ? (
        <p className="muted text-sm">
          No investigation report has been returned yet.
        </p>
      ) : (
        <div className="space-y-3">
          <TestResultCard kind="baseline" result={report.baseline} />
          <TestResultCard kind="regression" result={report.regressionAfter} />
          <TestResultCard kind="suite" result={report.suiteAfter} />
        </div>
      )}
      <p className="muted text-xs">
        A nonzero baseline exit code is evidence of failure before the fix, not
        proof by itself that the intended bug was reproduced. The verification
        outcome is determined by the AI service.
      </p>
    </section>
  );
}
