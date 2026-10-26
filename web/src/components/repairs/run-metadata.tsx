import type { Repair } from "@/types/repair";

function formatDate(value: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleString();
}

function duration(start: string | null, finish: string | null) {
  if (!start || !finish) return "N/A";
  const ms = new Date(finish).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "N/A";
  return `${(ms / 1000).toFixed(1)} seconds`;
}

export function RunMetadata({ repair }: { repair: Repair }) {
  const rows = [
    ["Repair ID", repair.id],
    ["Repository", repair.repository ?? "N/A"],
    ["Commit SHA", repair.commitSha ?? "N/A"],
    [
      "Issue type",
      repair.report?.assessment?.issueType ?? repair.report?.issueType ?? "N/A",
    ],
    ["Changed file", repair.report?.changedFile ?? "N/A"],
    ["Attempts", repair.attempts?.toString() ?? "N/A"],
    ["Created", formatDate(repair.createdAt)],
    ["Started", formatDate(repair.startedAt)],
    ["Finished", formatDate(repair.finishedAt)],
    ["Duration", duration(repair.startedAt, repair.finishedAt)],
  ];
  return (
    <section className="panel p-6">
      <h2 className="mb-5 text-lg font-semibold">Run metadata</h2>
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="muted text-xs">{label}</dt>
            <dd className="code mt-1 text-xs break-all text-slate-200">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
