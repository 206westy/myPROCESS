/**
 * GET /api/commonality?signal=&indicator=&recipe=&k=
 * 신호×지표의 컨텍스트 내 이상치를 표시하고, 차원별 과대표집(commonality)을 순위화.
 */

import { type NextRequest } from 'next/server';
import { buildCommonalityReport } from '@/lib/commonality/service';
import { commonalityQuerySchema, searchParamsToObject } from '@/lib/validation';
import { assertSignal, hasIndicatorTable } from '@/lib/data/queries';
import { assertIndicator } from '@/lib/indicators/catalog';
import { ok, fail } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const parsed = commonalityQuerySchema.safeParse(
    searchParamsToObject(req.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => i.message).join(', '));
  }
  const { signal, indicator, recipe, k } = parsed.data;
  try {
    assertSignal(signal);
    assertIndicator(indicator);
  } catch (err) {
    return fail(err instanceof Error ? err.message : '잘못된 파라미터');
  }

  try {
    if (!(await hasIndicatorTable())) {
      return fail('지표 테이블 없음 — pnpm build:indicators 실행 필요', 503);
    }
    const report = await buildCommonalityReport(signal, indicator, { recipe, k });
    return ok(report);
  } catch (err) {
    console.error('[api/commonality] 실패:', err);
    return fail('Commonality 분석 실패', 500);
  }
}
