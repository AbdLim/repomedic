import { getIssueMetadata } from '../../integrations/github/github.client.js';
import { HttpError } from '../../shared/errors.js';
import * as repository from './repair.repository.js';

export async function submitRepair(issueUrl: string) {
    const metadata = await getIssueMetadata(issueUrl);
    return repository.createRepair({
        issueUrl: metadata.canonicalUrl,
        repository: metadata.repository,
        issueNumber: metadata.issueNumber,
        issueTitle: metadata.issueTitle,
        commitSha: metadata.commitSha,
    });
}

export async function requireRepair(id: string) {
    const repair = await repository.getRepair(id);
    if (!repair) throw new HttpError(404, 'Repair not found');
    return repair;
}
