import { HttpError } from '../../shared/errors.js';

export function parseIssueUrl(raw: string) {
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        throw new HttpError(400, 'Invalid GitHub issue URL');
    }
    const p = url.pathname.split('/').filter(Boolean);
    if (
        url.protocol !== 'https:' ||
        url.hostname !== 'github.com' ||
        p.length !== 4 ||
        p[2] !== 'issues' ||
        !/^[1-9]\d*$/.test(p[3]) ||
        !p.slice(0, 2).every(x => /^[a-zA-Z0-9_.-]+$/.test(x))
    ) {
        throw new HttpError(
            400,
            'Expected https://github.com/{owner}/{repo}/issues/{number}',
        );
    }
    return {
        owner: p[0],
        repo: p[1],
        issueNumber: Number(p[3]),
        repository: `${p[0]}/${p[1]}`,
        canonicalUrl: `https://github.com/${p.join('/')}`,
    };
}
async function githubGet(path: string): Promise<any> {
    const response = await fetch(`https://api.github.com${path}`, {
        headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'RepoMedic',
            ...(process.env.GITHUB_TOKEN
                ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
                : {}),
        },
        signal: AbortSignal.timeout(10000),
    });
    if (response.status === 404)
        throw new HttpError(404, 'GitHub repository or issue not found');
    if (!response.ok)
        throw new HttpError(502, `GitHub API error: ${response.status}`);
    return response.json();
}
export async function getIssueMetadata(url: string) {
    const parsed = parseIssueUrl(url);
    const base = `/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`;
    const [repo, issue] = await Promise.all([
        githubGet(base),
        githubGet(`${base}/issues/${parsed.issueNumber}`),
    ]);
    if (repo.private)
        throw new HttpError(400, 'Only public repositories are supported');
    if (issue.pull_request)
        throw new HttpError(400, 'Pull request URLs are not supported');
    if (typeof repo.default_branch !== 'string')
        throw new HttpError(502, 'Missing default branch');
    const branch = await githubGet(
        `${base}/branches/${encodeURIComponent(repo.default_branch)}`,
    );
    const sha = branch?.commit?.sha;
    if (typeof sha !== 'string' || !/^[a-f0-9]{40}$/i.test(sha))
        throw new HttpError(502, 'GitHub did not return a valid commit SHA');
    return { ...parsed, issueTitle: String(issue.title), commitSha: sha };
}
