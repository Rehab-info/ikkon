import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError, ERROR_CODES, ERROR_MESSAGES } from './errors.ts';
import { parseRpcResult } from './rpc.ts';
import { MyContext } from './schemas.ts';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

describe('parseRpcResult', () => {
  it('returns data on success', () => {
    expect(parseRpcResult(z.array(z.number()), { ok: true, data: [1, 2] })).toEqual([1, 2]);
  });

  it('throws AppError with the server code', () => {
    expect(() => parseRpcResult(z.null(), { ok: false, error: 'forbidden' })).toThrowError(
      expect.objectContaining({ code: 'forbidden' }),
    );
  });

  it('maps unknown codes and malformed payloads to internal', () => {
    for (const raw of [
      { ok: false, error: 'sql exploded' },
      null,
      'x',
      { ok: true },
      { ok: true, data: 1, extra: 1 },
    ]) {
      try {
        parseRpcResult(z.number(), raw);
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(AppError);
        expect((e as AppError).code).toBe('internal');
      }
    }
  });

  it('rejects data that does not match the schema', () => {
    expect(() => parseRpcResult(MyContext, { ok: true, data: { registered: true } })).toThrowError(AppError);
  });
});

describe('error codes', () => {
  it('every code has a plain-language message', () => {
    for (const code of ERROR_CODES) expect(ERROR_MESSAGES[code].length).toBeGreaterThan(5);
  });

  it('every error code produced by SQL migrations is known to the client', () => {
    const dir = join(import.meta.dirname, '../../../supabase/migrations');
    const sql = readdirSync(dir)
      .map((f) => readFileSync(join(dir, f), 'utf8'))
      .join('\n');
    const produced = new Set<string>();
    // private.err(...) に渡される文字列(case 式の比較対象 `= '...'` は除く)
    for (const call of sql.matchAll(/(?<!function )private\.err\(([\s\S]*?)\);/g)) {
      for (const lit of call[1]!.matchAll(/(?<!= )'([a-z_]+)'/g)) produced.add(lit[1]!);
    }
    // private.deny がそのまま返す理由
    const passthrough = /p_reason in \(([^)]*)\)/.exec(sql)?.[1] ?? '';
    for (const lit of passthrough.matchAll(/'([a-z_]+)'/g)) produced.add(lit[1]!);
    expect(produced.size).toBeGreaterThan(3);
    for (const code of produced) expect(ERROR_CODES).toContain(code);
  });
});
