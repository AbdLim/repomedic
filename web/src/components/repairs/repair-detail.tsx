"use client";

import { repairsApi } from "@/lib/api/client";
import type { Repair, RepairEvent } from "@/types/repair";
import { ExternalLink, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { InvestigationPanel } from "./investigation-panel";
import { PatchViewer } from "./patch-viewer";
import { RepairProgress } from "./repair-progress";
import { RunMetadata } from "./run-metadata";
import { StatusBadge } from "./status-badge";
import { VerificationPanel } from "./verification-panel";

const TERMINAL = new Set(["completed", "failed", "cancelled"]);

export function RepairDetail({ id }: { id: string }) {
  const [repair, setRepair] = useState<Repair | null>(null);
  const [events, setEvents] = useState<RepairEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        // Repair detail is authoritative and includes the final report.
        const nextRepair = await repairsApi.get(id);
        if (!active) return;
        setRepair(nextRepair);
        setError(null);

        // Optional supplemental events, without blocking a usable report.
        if (
          !nextRepair.report?.timeline.length &&
          !TERMINAL.has(nextRepair.status)
        ) {
          const nextEvents = await repairsApi.events(id).catch(() => []);
          if (active) setEvents(nextEvents);
        }
        if (active && !TERMINAL.has(nextRepair.status)) {
          timer = setTimeout(poll, 5000);
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load repair");
        timer = setTimeout(poll, 10000);
      } finally {
        if (active) setLoading(false);
      }
    }
    void poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [id, revision]);

  if (loading && !repair) return <p className="muted">Loading repair…</p>;
  if (!repair)
    return (
      <div className="panel p-6">
        <p role="alert" className="text-rose-300">
          {error ?? "Repair not found"}
        </p>
        <button
          type="button"
          className="btn-secondary mt-4"
          onClick={() => {
            setLoading(true);
            setRevision((n) => n + 1);
          }}
        >
          Retry
        </button>
      </div>
    );

  const reportTimeline = repair.report?.timeline ?? [];
  const headline = repair.issueTitle || "Repair investigation";
  const verified = repair.verification === "verified";
  const hasVerification = repair.verification !== null;

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/repairs" className="muted text-xs hover:text-white">
            ← All repairs
          </Link>
          <h1 className="mt-3 max-w-3xl text-2xl leading-snug font-semibold">
            {headline}
          </h1>
          <p className="muted code mt-2 text-xs break-all">
            {repair.repository ?? "Unknown repository"}
            {repair.issueNumber !== null
              ? ` · Issue #${repair.issueNumber}`
              : ""}
            {repair.commitSha ? ` · ${repair.commitSha.slice(0, 8)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={repair.status} />
          {hasVerification && (
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${
                verified
                  ? "border-emerald-500/50 text-emerald-300"
                  : "border-amber-500/50 text-amber-300"
              }`}
            >
              {repair.verification}
            </span>
          )}
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => setRevision((n) => n + 1)}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </header>

      {error && (
        <p role="alert" className="text-sm text-amber-300">
          Connection issue: {error}. Retrying…
        </p>
      )}
      <RepairProgress status={repair.status} />

      <section className="panel p-6">
        <h2 className="font-semibold">Source issue</h2>
        {repair.issueUrl ? (
          <a
            href={repair.issueUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex max-w-full items-center gap-2 text-sm break-all text-[#b7a4ff] hover:underline"
          >
            {repair.issueUrl} <ExternalLink size={14} className="shrink-0" />
          </a>
        ) : (
          <p className="muted mt-3 text-sm">Issue URL unavailable</p>
        )}
      </section>

      <InvestigationPanel repair={repair} />
      <VerificationPanel repair={repair} />

      {/* Phase 6 below updates PatchViewer to use this embedded patch first. */}
      <PatchViewer
        id={id}
        status={repair.status}
        inlinePatch={repair.report?.patch ?? null}
        changedFile={repair.report?.changedFile ?? null}
      />

      <section className="panel p-6">
        <h2 className="font-semibold">Investigation timeline</h2>
        {reportTimeline.length ? (
          <ol className="mt-5 space-y-4 border-l border-[#29313c] pl-5">
            {reportTimeline.map((step, index) => (
              <li key={index} className="relative">
                <span className="absolute top-1 -left-6.25 h-2 w-2 rounded-full bg-[#b7a4ff]" />
                <p className="text-sm">{step}</p>
              </li>
            ))}
          </ol>
        ) : events.length ? (
          <ol className="mt-5 space-y-4 border-l border-[#29313c] pl-5">
            {events.map((event) => (
              <li key={event.id} className="relative">
                <span className="absolute top-1 -left-6.25 h-2 w-2 rounded-full bg-[#b7a4ff]" />
                <p className="text-sm">{event.message}</p>
                <p className="muted code mt-1 text-xs">
                  {event.status} · {new Date(event.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted mt-4 text-sm">No timeline recorded yet.</p>
        )}
      </section>

      <RunMetadata repair={repair} />
    </div>
  );
}
