/**
 * GET /api/yield?recipe=&stage=&step=&indicator=&response=
 * 지표↔수율 상관 — 수율 테이블(wafer_quality)이 있을 때만 동작.
 * 컨텍스트가 없으면 데이터 유무만 반환(페이지 게이팅용).
 */

import { type NextRequest } from 'next/server';
import {
  hasQualityData,
  hasIndicatorTable,
  getYieldCorrelations,
} from '@/lib/data/queries';
import { assertIndicator } from '@/lib/indicators/catalog';
import { assertQualityResponse } from '@/lib/yield/schema';
import { searchParamsToObject } from '@/lib/validation';
import { ok, fail } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const hasData = (await hasQualityData()) && (await hasIndicatorTable());
    const p = searchParamsToObject(req.nextUrl.searchParams);

    if (!hasData || !p.recipe || !p.stage || p.step === undefined) {
      return ok({ hasData, correlations: [] });
    }

    const indicator = p.indicator || 'mean';
    const response = p.response || 'yield_pct';
    assertIndicator(indicator);
    assertQualityResponse(response);

    const correlations = await getYieldCorrelations(
      { recipe: p.recipe, stage: p.stage, recipeStepNum: Number(p.step) },
      indicator,
      response,
    );
    return ok({ hasData, correlations });
  } catch (err) {
    console.error('[api/yield] 실패:', err);
    return fail(err instanceof Error ? err.message : '수율 상관 분석 실패', 500);
  }
}
