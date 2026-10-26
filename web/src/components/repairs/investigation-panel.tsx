import type { Repair } from "@/types/repair";

function Finding({
  title,
  value,
}: {
  title: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div>
      <h3 className="muted mb-2 text-xs font-medium tracking-wide uppercase">
        {title}
      </h3>
      <p className="text-sm leading-6 whitespace-pre-wrap text-slate-200">
        {value}
      </p>
    </div>
  );
}

export function InvestigationPanel({ repair }: { repair: Repair }) {
  const report = repair.report;
  const assessment = report?.assessment;
  return (
    <section className="panel space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold">Investigation</h2>
        <p className="muted mt-1 text-xs">
          Reported behavior, diagnosis, and proposed correction.
        </p>
      </div>
      {assessment && (
        <div className="grid gap-5 md:grid-cols-2">
          <Finding
            title="Current behavior"
            value={assessment.currentBehavior}
          />
          <Finding
            title="Expected behavior"
            value={assessment.requestedBehavior}
          />
        </div>
      )}
      <Finding title="Assessment" value={assessment?.reasoning} />
      {assessment?.evidence && assessment.evidence.length > 0 && (
        <div>
          <h3 className="muted mb-2 text-xs tracking-wide uppercase">
            Evidence
          </h3>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            {assessment.evidence.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      <Finding title="Root cause" value={repair.rootCause} />
      <Finding title="Fix explanation" value={repair.explanation} />
      <Finding title="Suggestion" value={report?.suggestion} />
      <Finding
        title="Clarification needed"
        value={assessment?.clarificationQuestion}
      />
      {(repair.error || report?.error) && (
        <p
          role="alert"
          className="rounded-lg border border-rose-500/30 p-4 text-sm text-rose-300"
        >
          {repair.error ?? report?.error}
        </p>
      )}
      {!assessment &&
        !repair.rootCause &&
        !repair.explanation &&
        !repair.error && (
          <p className="muted text-sm">
            Investigation findings are not available yet.
          </p>
        )}
    </section>
  );
}
