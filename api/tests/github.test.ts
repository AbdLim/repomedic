import { describe, expect, it } from 'vitest';
import { parseIssueUrl } from '../src/integrations/github/github.client.js';

describe('GitHub issue URL', () => {
    it('accepts a public issue URL', () =>
        expect(
            parseIssueUrl('https://github.com/AbdLim/repomedic-bench/issues/1'),
        ).toMatchObject({
            repository: 'AbdLim/repomedic-bench',
            issueNumber: 1,
        }));
    it('rejects non GitHub URLs', () =>
        expect(() =>
            parseIssueUrl('https://example.com/x/y/issues/1'),
        ).toThrow());
    it('rejects pull requests', () =>
        expect(() => parseIssueUrl('https://github.com/x/y/pull/1')).toThrow());
});
