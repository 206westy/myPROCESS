/**
 * GET /api/context
 * SPC/FDC 선택기에 필요한 메타: 컨텍스트(Recipe×Stage×Step) 목록 +
 * 신호 통계(아날로그/플래그 구분).
 */

import { listContexts, listSignalStats } from '@/lib/data/queries';
import { ok, fail } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [contexts, signals] = await Promise.all([
      listContexts(),
      listSignalStats(),
    ]);
    return ok({ contexts, signals });
  } catch (err) {
    console.error('[api/context] 실패:', err);
    return fail('컨텍스트 메타 조회 실패', 500);
  }
}
