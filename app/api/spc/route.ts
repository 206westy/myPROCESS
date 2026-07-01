/**
 * GET /api/spc?recipe=&stage=&step=&signal=
 * 한 컨텍스트×신호의 컨텍스트 적응형 관리도(점 + 동적 한계 + 위반).
 */

import { type NextRequest } from 'next/server';
import { buildAdaptiveControlChart } from '@/lib/spc/service';
import { spcQuerySchema, searchParamsToObject } from '@/lib/validation';
import { assertSignal } from '@/lib/data/queries';
import { assertIndicator } from '@/lib/indicators/catalog';
import { ok, fail } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const parsed = spcQuerySchema.safeParse(
    searchParamsToObject(req.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => i.message).join(', '));
  }

  const { recipe, stage, step, signal, indicator } = parsed.data;
  try {
    assertSignal(signal); // 화이트리스트 검증(인젝션 방지)
    assertIndicator(indicator); // 지표 화이트리스트 검증
  } catch (err) {
    return fail(err instanceof Error ? err.message : `잘못된 파라미터`);
  }

  try {
    const result = await buildAdaptiveControlChart(
      { recipe, stage, recipeStepNum: step },
      signal,
      indicator,
    );
    return ok(result);
  } catch (err) {
    console.error('[api/spc] 실패:', err);
    return fail('관리도 산출 실패', 500);
  }
}
