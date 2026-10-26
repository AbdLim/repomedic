import { env } from '../../config/env.js';

export interface RepairInput {
    issue_url: string;
    repository: string;
    commit_sha: string;
}

export interface RepairOutput {
    status: string;
    patch?: string | null;
    root_cause?: string | null;
    explanation?: string | null;
    changed_file?: string | null;
    [key: string]: unknown;
}

export async function runAiRepair(input: RepairInput): Promise<RepairOutput> {
    const url = new URL(env.AI_REPAIR_PATH, env.AI_SERVICE_URL);
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(env.AI_SERVICE_TOKEN
                ? { 'x-internal-api-key': env.AI_SERVICE_TOKEN }
                : {}),
        },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(env.AI_TIMEOUT_MS),
    });
    if (!response.ok)
        throw new Error(
            `AI service returned HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`,
        );
    const result: unknown = await response.json();
    if (!result || typeof result !== 'object' || Array.isArray(result))
        throw new Error('Invalid AI repair response');
    return result as RepairOutput;
}
