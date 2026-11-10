import { mockAdapter } from './mock.ts';
import type { AiAdapter } from './schema.ts';

/**
 * プロバイダの選択(環境変数 AI_PROVIDER)。実際の AI プロバイダは D-01 の決定後に追加する。
 * それまでは mock だけ。未知の値は null(解析できない = ai_unavailable)。
 */
export function selectAdapter(name: string | undefined): AiAdapter | null {
  if (name === 'mock') return mockAdapter;
  return null;
}
