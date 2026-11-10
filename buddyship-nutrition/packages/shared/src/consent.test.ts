import { describe, expect, it } from 'vitest';
import { SCOPE_LABELS, SCOPE_ORDER, revokeConfirmMessage } from './consent.ts';
import { ConsentScope, InviteUserRequest } from './schemas.ts';

describe('consent scopes', () => {
  it('labels cover every scope and avoid jargon', () => {
    expect([...SCOPE_ORDER].sort()).toEqual([...ConsentScope.options].sort());
    for (const s of SCOPE_ORDER) expect(SCOPE_LABELS[s].label).not.toMatch(/PFC|スコープ|consent/i);
  });

  it('read and write are separate choices per data type', () => {
    expect(SCOPE_LABELS['meals:read'].label).not.toBe(SCOPE_LABELS['meals:write'].label);
    expect(SCOPE_LABELS['body:read'].label).not.toBe(SCOPE_LABELS['body:write'].label);
  });

  it('revoke message warns that already-seen data cannot be undone', () => {
    const msg = revokeConfirmMessage('山田', 'meals:read');
    expect(msg).toContain('山田さん');
    expect(msg).toContain('食事の記録を見る');
    expect(msg).toContain('取り消せません');
  });
});

describe('InviteUserRequest', () => {
  const base = { email: 'a@example.com', display_name: ' 山田 ', role: 'member', facility_id: null };
  it('accepts a valid request and trims the name', () => {
    expect(InviteUserRequest.parse(base).display_name).toBe('山田');
  });
  it.each([
    [{ ...base, role: 'admin' }],
    [{ ...base, email: 'not-an-email' }],
    [{ ...base, display_name: '   ' }],
    [{ ...base, display_name: 'あ'.repeat(51) }],
    [{ ...base, extra: true }],
  ])('rejects %j', (input) => {
    expect(InviteUserRequest.safeParse(input).success).toBe(false);
  });
});
