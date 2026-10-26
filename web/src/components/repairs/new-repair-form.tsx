"use client";

import { repairsApi } from "@/lib/api/client";
import { environmentKeySchema, issueUrlSchema } from "@/lib/validation/repair";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type EnvRow = { id: number; key: string; value: string };

export function NewRepairForm() {
  const router = useRouter();
  const [issueUrl, setIssueUrl] = useState("");
  const [rows, setRows] = useState<EnvRow[]>([]);
  const [nextId, setNextId] = useState(1);
  const [showValues, setShowValues] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addRow() {
    setRows((current) => [...current, { id: nextId, key: "", value: "" }]);
    setNextId((value) => value + 1);
  }
  function updateRow(id: number, field: "key" | "value", value: string) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    const parsed = issueUrlSchema.safeParse(issueUrl.trim());
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid issue URL");
      return;
    }
    const environment: Record<string, string> = {};
    for (const row of rows) {
      const key = row.key.trim();
      if (!key && !row.value) continue;
      const validKey = environmentKeySchema.safeParse(key);
      if (!validKey.success) {
        setError(
          `Invalid environment variable name in row ${rows.indexOf(row) + 1}`,
        );
        return;
      }
      if (Object.hasOwn(environment, key)) {
        setError(`Duplicate environment variable name: ${key}`);
        return;
      }
      environment[key] = row.value;
    }
    setSubmitting(true);
    try {
      const repair = await repairsApi.create({
        issue_url: parsed.data,
        environment: environment,
      });
      // Remove sensitive values from component state before leaving the page.
      setRows([]);
      router.replace(`/repairs/${encodeURIComponent(repair.id)}`);
    } catch (err) {
      // Backend error messages should be sanitized by Express before returning them.
      setError(err instanceof Error ? err.message : "Unable to create repair");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="panel p-6">
        <label htmlFor="issue-url" className="mb-2 block text-sm font-semibold">
          GitHub issue URL
        </label>
        <input
          id="issue-url"
          className="field"
          type="url"
          required
          autoComplete="off"
          placeholder="https://github.com/owner/repo/issues/123"
          value={issueUrl}
          onChange={(event) => setIssueUrl(event.target.value)}
        />
        <p className="muted mt-3 text-xs">
          The agent will investigate the reported issue and attempt a verified
          patch.
        </p>
      </section>
      <section className="panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">
              Environment variables{" "}
              <span className="muted text-sm font-normal">(optional)</span>
            </h2>
            <p className="muted mt-2 text-xs">
              Passed to the repair sandbox when required for reproduction. Treat
              values as secrets.
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={addRow}
          >
            <Plus size={15} /> Add variable
          </button>
        </div>
        {rows.length > 0 && (
          <label className="muted mt-5 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={showValues}
              onChange={(event) => setShowValues(event.target.checked)}
            />{" "}
            Show values
          </label>
        )}
        <div className="mt-4 space-y-3">
          {rows.map((row) => (
            <div
              key={row.id}
              className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]"
            >
              <input
                aria-label="Variable name"
                className="field code text-sm"
                placeholder="API_TOKEN"
                autoComplete="off"
                value={row.key}
                onChange={(event) =>
                  updateRow(row.id, "key", event.target.value)
                }
              />
              <input
                aria-label="Variable value"
                className="field code text-sm"
                placeholder="Value"
                autoComplete="off"
                spellCheck={false}
                type={showValues ? "text" : "password"}
                value={row.value}
                onChange={(event) =>
                  updateRow(row.id, "value", event.target.value)
                }
              />
              <button
                type="button"
                aria-label="Remove variable"
                className="btn-secondary"
                onClick={() =>
                  setRows((current) =>
                    current.filter((item) => item.id !== row.id),
                  )
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </section>
      {error && (
        <p role="alert" className="text-sm text-rose-300">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="muted max-w-lg text-xs">
          Do not submit production credentials unless the backend sandbox is
          explicitly approved to receive them.
        </p>
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? "Starting repair…" : "Start repair"}
        </button>
      </div>
    </form>
  );
}
