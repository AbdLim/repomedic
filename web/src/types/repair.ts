export const REPAIR_STATUSES = [
  "queued",
  "investigating",
  "reproducing",
  "patching",
  "verifying",
  "completed",
  "failed",
  "cancelled",
] as const;

export type RepairStatus = (typeof REPAIR_STATUSES)[number];

export type VerificationStatus = "verified" | "unverified" | "unknown" | string;

export interface TestExecution {
  output: string;
  exitCode: number | null;
  timedOut: boolean;
}

export interface RepairAssessment {
  evidence: string[];
  reasoning: string | null;
  issueType: string | null;
  currentBehavior: string | null;
  requestedBehavior: string | null;
  clarificationQuestion: string | null;
}

export interface RepairReport {
  status: string | null;
  error: string | null;
  patch: string | null;
  baseline: TestExecution | null;
  regressionAfter: TestExecution | null;
  suiteAfter: TestExecution | null;
  timeline: string[];
  assessment: RepairAssessment | null;
  issueType: string | null;
  rootCause: string | null;
  explanation: string | null;
  suggestion: string | null;
  changedFile: string | null;
  commitSha: string | null;
  repository: string | null;
  issueUrl: string | null;
}

export interface Repair {
  id: string;
  issueUrl: string;
  issueNumber: number | null;
  issueTitle: string | null;
  repository: string | null;
  commitSha: string | null;
  status: RepairStatus;
  verification: VerificationStatus | null;
  report: RepairReport | null;
  createdAt: string;
  updatedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  attempts: number | null;
  rootCause: string | null;
  explanation: string | null;
  error: string | null;
}

export interface RepairEvent {
  id: string;
  repairId: string;
  status: string;
  message: string;
  createdAt: string;
}

export interface CreateRepairInput {
  issue_url: string;
  environment: Record<string, string>;
}
