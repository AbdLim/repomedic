import type { CreateRepairInput, Repair, RepairEvent } from "@/types/repair";
import {
  normalizeEvents,
  normalizePatch,
  normalizeRepair,
  normalizeRepairs,
} from "./normalizers";

const BASE = "/api/backend/repairs";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    cache: "no-store",
  });
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("json")
    ? await response.json().catch(() => null)
    : await response.text();
  if (!response.ok) {
    const record =
      body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const message =
      typeof record.message === "string"
        ? record.message
        : typeof record.error === "string"
          ? record.error
          : `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }
  return body;
}

export const repairsApi = {
  list: async (): Promise<Repair[]> => normalizeRepairs(await request("")),
  get: async (id: string): Promise<Repair> =>
    normalizeRepair(await request(`/${encodeURIComponent(id)}`)),
  events: async (id: string): Promise<RepairEvent[]> =>
    normalizeEvents(await request(`/${encodeURIComponent(id)}/events`)),
  patch: async (id: string): Promise<string> =>
    normalizePatch(await request(`/${encodeURIComponent(id)}/patch`)),
  create: async (input: CreateRepairInput): Promise<Repair> =>
    normalizeRepair(
      await request("", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    ),
};
