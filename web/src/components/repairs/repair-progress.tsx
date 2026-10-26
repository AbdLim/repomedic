import type { RepairStatus } from "@/types/repair";
import { Check, Circle, LoaderCircle } from "lucide-react";

const steps = [
  "queued",
  "investigating",
  "reproducing",
  "patching",
  "verifying",
  "completed",
] as const;

export function RepairProgress({ status }: { status: RepairStatus }) {
  const index = steps.indexOf(status as (typeof steps)[number]);
  const terminalError = status === "failed" || status === "cancelled";
  return (
    <ol className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {steps.map((step, position) => {
        const done =
          (!terminalError && position < index) || status === "completed";
        const current = !terminalError && position === index;
        return (
          <li
            key={step}
            className={`panel flex items-center gap-3 p-3 text-xs capitalize ${current ? "border-[#b7a4ff]" : ""}`}
          >
            {done ? (
              <Check size={15} className="text-emerald-300" />
            ) : current ? (
              <LoaderCircle size={15} className="animate-spin text-[#b7a4ff]" />
            ) : (
              <Circle size={15} className="text-[#929dab]" />
            )}
            {step}
          </li>
        );
      })}
    </ol>
  );
}
