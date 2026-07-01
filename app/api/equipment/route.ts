/**
 * GET /api/equipment?pm=
 * 트레이스 재구성 기반 장비 가동/유휴 통계 + RF 누적 PM 프록시.
 */

import { type NextRequest } from 'next/server';
import { buildEquipmentReport, DEFAULT_PM_THRESHOLD } from '@/lib/equipment/service';
import { ok, fail } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const pmRaw = req.nextUrl.searchParams.get('pm');
  const pm = pmRaw ? Number(pmRaw) : DEFAULT_PM_THRESHOLD;
  if (!Number.isFinite(pm) || pm <= 0) return fail('pm은 양수여야 함');

  try {
    const report = await buildEquipmentReport(pm);
    return ok(report);
  } catch (err) {
    console.error('[api/equipment] 실패:', err);
    return fail('장비 분석 실패', 500);
  }
}
