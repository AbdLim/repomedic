import type {
  Repair,
  RepairAssessment,
  RepairEvent,
  RepairReport,
  RepairStatus,
  TestExecution,
} from "@/types/repair";
import { REPAIR_STATUSES } from "@/types/repair";

type Dict = Record<string, unknown>;

function obj(value: unknown): Dict {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Dict)
    : {};
}

function valueOf(record: Dict, ...keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function bool(value: unknown): boolean {
  return value === true;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

function unwrap(value: unknown): unknown {
  const record = obj(value);
  return "data" in record ? record.data : value;
}

function status(value: unknown): RepairStatus {
  return REPAIR_STATUSES.includes(value as RepairStatus)
    ? (value as RepairStatus)
    : "queued";
}

function normalizeTest(value: unknown): TestExecution | null {
  if (value === null || value === undefined) return null;
  const r = obj(value);
  if (!Object.keys(r).length) return null;
  return {
    output: text(r.output) ?? "",
    exitCode: number(valueOf(r, "exit_code", "exitCode")),
    timedOut: bool(valueOf(r, "timed_out", "timedOut")),
  };
}

function normalizeAssessment(value: unknown): RepairAssessment | null {
  if (value === null || value === undefined) return null;
  const r = obj(value);
  if (!Object.keys(r).length) return null;
  return {
    evidence: stringList(r.evidence),
    reasoning: text(r.reasoning),
    issueType: text(valueOf(r, "issue_type", "issueType")),
    currentBehavior: text(valueOf(r, "current_behavior", "currentBehavior")),
    requestedBehavior: text(
      valueOf(r, "requested_behavior", "requestedBehavior"),
    ),
    clarificationQuestion: text(
      valueOf(r, "clarification_question", "clarificationQuestion"),
    ),
  };
}

function normalizeReport(value: unknown): RepairReport | null {
  if (value === null || value === undefined) return null;
  const r = obj(value);
  if (!Object.keys(r).length) return null;
  return {
    status: text(r.status),
    error: text(r.error),
    patch: text(r.patch),
    baseline: normalizeTest(r.baseline),
    regressionAfter: normalizeTest(
      valueOf(r, "regression_after", "regressionAfter"),
    ),
    suiteAfter: normalizeTest(valueOf(r, "suite_after", "suiteAfter")),
    timeline: stringList(r.timeline),
    assessment: normalizeAssessment(r.assessment),
    issueType: text(valueOf(r, "issue_type", "issueType")),
    rootCause: text(valueOf(r, "root_cause", "rootCause")),
    explanation: text(r.explanation),
    suggestion: text(r.suggestion),
    changedFile: text(valueOf(r, "changed_file", "changedFile")),
    commitSha: text(valueOf(r, "commit_sha", "commitSha")),
    repository: text(r.repository),
    issueUrl: text(valueOf(r, "issue_url", "issueUrl")),
  };
}

export function normalizeRepair(raw: unknown): Repair {
  const r = obj(unwrap(raw));
  const id = text(r.id);
  if (!id) throw new Error("Backend returned a repair without an id");
  const report = normalizeReport(r.report);
  const verification = text(r.verification) ?? report?.status ?? null;
  return {
    id,
    issueUrl:
      text(valueOf(r, "issue_url", "issueUrl")) ?? report?.issueUrl ?? "",
    issueNumber: number(valueOf(r, "issue_number", "issueNumber")),
    issueTitle: text(valueOf(r, "issue_title", "issueTitle")),
    repository: text(r.repository) ?? report?.repository ?? null,
    commitSha:
      text(valueOf(r, "commit_sha", "commitSha")) ?? report?.commitSha ?? null,
    status: status(r.status),
    verification,
    report,
    createdAt:
      text(valueOf(r, "created_at", "createdAt")) ?? new Date(0).toISOString(),
    updatedAt: text(valueOf(r, "updated_at", "updatedAt")),
    startedAt: text(valueOf(r, "started_at", "startedAt")),
    finishedAt: text(valueOf(r, "finished_at", "finishedAt")),
    attempts: number(r.attempts),
    rootCause:
      text(valueOf(r, "root_cause", "rootCause")) ?? report?.rootCause ?? null,
    explanation: text(r.explanation) ?? report?.explanation ?? null,
    error: text(r.error) ?? report?.error ?? null,
  };
}

export function normalizeRepairs(raw: unknown): Repair[] {
  const unwrapped = unwrap(raw);
  const record = obj(unwrapped);
  const list = Array.isArray(unwrapped) ? unwrapped : record.repairs;
  if (!Array.isArray(list)) throw new Error("Unexpected repair list response");
  return list.map(normalizeRepair);
}

export function normalizeEvents(raw: unknown): RepairEvent[] {
  const unwrapped = unwrap(raw);
  const record = obj(unwrapped);
  const list = Array.isArray(unwrapped) ? unwrapped : record.events;
  if (!Array.isArray(list))
    throw new Error("Unexpected repair events response");
  return list.map((item, index) => {
    const e = obj(item);
    return {
      id: text(e.id) ?? `event-${index}`,
      repairId: text(valueOf(e, "repair_id", "repairId")) ?? "",
      status: text(e.status) ?? text(e.type) ?? "update",
      message: text(e.message) ?? text(e.description) ?? "Repair updated",
      createdAt:
        text(valueOf(e, "created_at", "createdAt")) ??
        new Date(0).toISOString(),
    };
  });
}

export function normalizePatch(raw: unknown): string {
  if (typeof raw === "string") return raw;
  const r = obj(unwrap(raw));
  return text(r.patch) ?? text(r.diff) ?? text(r.content) ?? "";
}
