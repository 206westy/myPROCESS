/**
 * GET /api/spc?recipe=&stage=&step=&signal=
 * 한 컨텍스트×신호의 컨텍스트 적응형 관리도(점 + 동적 한계 + 위반).
 */

import { type NextRequest } from 'next/server';
import { buildControlChart } from '@/lib/spc/service';
import { spcQuerySchema, searchParamsToObject } from '@/lib/validation';
import { assertSignal } from '@/lib/data/queries';
import { ok, fail } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const parsed = spcQuerySchema.safeParse(
    searchParamsToObject(req.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => i.message).join(', '));
  }

  const { recipe, stage, step, signal } = parsed.data;
  try {
    assertSignal(signal); // 화이트리스트 검증(인젝션 방지)
  } catch {
    return fail(`알 수 없는 신호명: ${signal}`);
  }

  try {
    const result = await buildControlChart(
      { recipe, stage, recipeStepNum: step },
      signal,
    );
    return ok(result);
  } catch (err) {
    console.error('[api/spc] 실패:', err);
    return fail('관리도 산출 실패', 500);
  }
}
