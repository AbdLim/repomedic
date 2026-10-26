"use client";

import { repairsApi } from "@/lib/api/client";
import type { RepairStatus } from "@/types/repair";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  id: string;
  status: RepairStatus;
  inlinePatch?: string | null;
  changedFile?: string | null;
};

export function PatchViewer({ id, status, inlinePatch, changedFile }: Props) {
  const [fetchedPatch, setFetchedPatch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revision, setRevision] = useState(0);
  const patch = inlinePatch || fetchedPatch;

  useEffect(() => {
    setFetchedPatch("");
    setError(null);
    if (status !== "completed" || inlinePatch) return;
    let active = true;
    setLoading(true);
    repairsApi
      .patch(id)
      .then((value) => {
        if (active) {
          setFetchedPatch(value);
          setError(null);
        }
      })
      .catch((err) => {
        if (active)
          setError(err instanceof Error ? err.message : "Patch unavailable");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, status, inlinePatch, revision]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(patch);
      setCopied(true);
    } catch {
      setError("Clipboard access was denied");
    }
  }

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#29313c] p-5">
        <div>
          <h2 className="font-semibold">Proposed patch</h2>
          <p className="muted mt-1 text-xs break-all">
            {changedFile ?? "File not specified"} · Review before applying. No
            automatic push.
          </p>
        </div>
        {patch && (
          <button
            type="button"
            onClick={copy}
            className="btn-secondary text-xs"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy diff"}
          </button>
        )}
      </div>
      {status !== "completed" && !patch ? (
        <p className="muted p-6 text-sm">No completed patch available yet.</p>
      ) : loading && !patch ? (
        <p className="muted p-6 text-sm">Loading patch…</p>
      ) : error && !patch ? (
        <div className="p-6">
          <p role="alert" className="text-sm text-rose-300">
            {error}
          </p>
          <button
            type="button"
            className="btn-secondary mt-3 text-xs"
            onClick={() => setRevision((x) => x + 1)}
          >
            Retry
          </button>
        </div>
      ) : !patch ? (
        <p className="muted p-6 text-sm">
          No patch was returned for this repair.
        </p>
      ) : (
        <pre className="code max-h-[600px] overflow-auto p-5 text-xs leading-6">
          <code>
            {patch.split("\n").map((line, index) => (
              <span
                key={index}
                className={`block min-w-max whitespace-pre ${
                  line.startsWith("+") && !line.startsWith("+++")
                    ? "bg-emerald-500/10 text-emerald-300"
                    : line.startsWith("-") && !line.startsWith("---")
                      ? "bg-rose-500/10 text-rose-300"
                      : line.startsWith("@@")
                        ? "text-sky-300"
                        : ""
                }`}
              >
                {line || " "}
              </span>
            ))}
          </code>
        </pre>
      )}
    </section>
  );
}
