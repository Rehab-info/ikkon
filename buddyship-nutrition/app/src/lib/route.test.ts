import { describe, expect, it } from 'vitest';
import type { MyContext } from '@buddyship/shared';
import { decideGate } from './route.ts';

const base = {
  registered: true as const,
  user_id: '00000000-0000-4000-8000-000000000010',
  display_name: 'テスト',
  font_scale: 0 as const,
  organization_id: '00000000-0000-4000-8000-000000000001',
  facility_id: null,
  pending_documents: [],
};
const ctx = (over: Partial<Extract<MyContext, { registered: true }>>): MyContext => ({
  ...base,
  roles: ['member'],
  aal: 'aal1',
  ...over,
});

describe('decideGate', () => {
  it('loading and signed out', () => {
    expect(decideGate({ loading: true, signedIn: false, context: null }).kind).toBe('loading');
    expect(decideGate({ loading: false, signedIn: false, context: null }).kind).toBe('login');
  });

  it('accounts without profile or roles cannot proceed', () => {
    expect(decideGate({ loading: false, signedIn: true, context: { registered: false } }).kind).toBe('not_registered');
    expect(decideGate({ loading: false, signedIn: true, context: ctx({ roles: [] }) }).kind).toBe('not_registered');
  });

  it('staff and admin must complete MFA first', () => {
    expect(decideGate({ loading: false, signedIn: true, context: ctx({ roles: ['staff'] }) }).kind).toBe('mfa');
    expect(decideGate({ loading: false, signedIn: true, context: ctx({ roles: ['admin'] }) }).kind).toBe('mfa');
    expect(decideGate({ loading: false, signedIn: true, context: ctx({ roles: ['member', 'staff'] }) }).kind).toBe(
      'mfa',
    );
  });

  it('members do not need MFA', () => {
    expect(decideGate({ loading: false, signedIn: true, context: ctx({}) })).toEqual({
      kind: 'ready',
      home: '/',
      roles: ['member'],
    });
  });

  it('pending documents come before the app', () => {
    const doc = {
      id: '00000000-0000-4000-8000-000000000099',
      kind: 'terms' as const,
      version: 'v',
      title: 't',
      body: 'b',
    };
    expect(decideGate({ loading: false, signedIn: true, context: ctx({ pending_documents: [doc] }) }).kind).toBe(
      'onboarding',
    );
  });

  it('home depends on role', () => {
    expect(
      decideGate({ loading: false, signedIn: true, context: ctx({ roles: ['staff'], aal: 'aal2' }) }),
    ).toMatchObject({ home: '/staff' });
    expect(
      decideGate({ loading: false, signedIn: true, context: ctx({ roles: ['admin'], aal: 'aal2' }) }),
    ).toMatchObject({ home: '/admin' });
  });
});
