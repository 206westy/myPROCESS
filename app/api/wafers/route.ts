/**
 * GET /api/wafers
 * FDC 선택기용 (Lot×Wafer×Recipe×Stage×Step) 목록.
 */

import { listWaferSteps } from '@/lib/data/queries';
import { ok, fail } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const waferSteps = await listWaferSteps();
    return ok({ waferSteps });
  } catch (err) {
    console.error('[api/wafers] 실패:', err);
    return fail('웨이퍼 목록 조회 실패', 500);
  }
}
