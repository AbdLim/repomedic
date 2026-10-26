import type { RepairStatus } from "@/types/repair";

const colors: Record<RepairStatus, string> = {
  queued: "border-slate-600 text-slate-300",
  investigating: "border-blue-500/50 text-blue-300",
  reproducing: "border-cyan-500/50 text-cyan-300",
  patching: "border-violet-500/50 text-violet-300",
  verifying: "border-amber-500/50 text-amber-300",
  completed: "border-emerald-500/50 text-emerald-300",
  failed: "border-rose-500/50 text-rose-300",
  cancelled: "border-slate-600 text-slate-400",
};

export function StatusBadge({ status }: { status: RepairStatus }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${colors[status]}`}
    >
      {status}
    </span>
  );
}
