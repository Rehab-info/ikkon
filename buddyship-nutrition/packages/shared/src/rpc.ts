import { z } from 'zod';
import { AppError, isErrorCode } from './errors.ts';

const Envelope = z.union([
  z.object({ ok: z.literal(true), data: z.unknown() }).strict(),
  z.object({ ok: z.literal(false), error: z.string() }).strict(),
]);

/**
 * RPC の返り値 {ok, data} / {ok:false, error} を検証して data を返す。
 * 失敗・想定外の形はすべて AppError にする(画面に内部情報を出さない)。
 */
export function parseRpcResult<T extends z.ZodType>(schema: T, raw: unknown): z.output<T> {
  const env = Envelope.safeParse(raw);
  if (!env.success) throw new AppError('internal');
  if (!env.data.ok) {
    throw new AppError(isErrorCode(env.data.error) ? env.data.error : 'internal');
  }
  const parsed = schema.safeParse(env.data.data);
  if (!parsed.success) throw new AppError('internal');
  return parsed.data;
}
