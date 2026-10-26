"use client";

import { repairsApi } from "@/lib/api/client";
import type { Repair } from "@/types/repair";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusBadge } from "./status-badge";

function displayDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString();
}

export function RepairList() {
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    repairsApi
      .list()
      .then((data) => {
        if (active) {
          setRepairs(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (active)
          setError(
            err instanceof Error ? err.message : "Could not load repairs",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const activeCount = repairs.filter(
    (r) => !["completed", "failed", "cancelled"].includes(r.status),
  ).length;
  const completedCount = repairs.filter((r) => r.status === "completed").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Total repairs", repairs.length],
          ["In progress", activeCount],
          ["Completed", completedCount],
        ].map(([label, count]) => (
          <div key={label} className="panel p-5">
            <p className="muted text-sm">{label}</p>
            <p className="mt-3 text-3xl font-semibold">{count}</p>
          </div>
        ))}
      </div>
      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#29313c] p-5">
          <h2 className="font-semibold">Repair runs</h2>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setRefreshKey((x) => x + 1);
            }}
            className="btn-secondary text-xs"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
        {loading ? (
          <p className="muted p-6 text-sm">Loading repairs…</p>
        ) : error ? (
          <p role="alert" className="p-6 text-sm text-rose-300">
            {error}
          </p>
        ) : repairs.length === 0 ? (
          <div className="p-10 text-center">
            <h3 className="font-medium">No repair runs yet</h3>
            <p className="muted mt-2 text-sm">
              Submit a GitHub issue to start the first investigation.
            </p>
            <Link href="/repairs/new" className="btn-primary mt-5 text-sm">
              Start a repair
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-[#29313c]">
            {repairs.map((repair) => (
              <Link
                key={repair.id}
                href={`/repairs/${encodeURIComponent(repair.id)}`}
                className="flex flex-wrap items-center justify-between gap-4 p-5 hover:bg-[#19202b]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {repair.repository ?? repair.issueUrl ?? repair.id}
                  </p>
                  <p className="muted code mt-2 text-xs">
                    {repair.id} · {displayDate(repair.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <StatusBadge status={repair.status} />
                  <ArrowUpRight size={16} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
