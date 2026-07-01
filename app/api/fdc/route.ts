/**
 * GET /api/fdc?recipe=&stage=&step=&signals=a,b,c
 * 한 컨텍스트의 다변량 FDC(Hotelling T² + SPE/Q + 결합 기여도 root-cause).
 * signals 미지정 시 대표 아날로그 신호군을 사용한다.
 */

import { type NextRequest } from 'next/server';
import { getWaferMatrix } from '@/lib/data/queries';
import { runFdc } from '@/lib/fdc/service';
import { fdcQuerySchema, searchParamsToObject } from '@/lib/validation';
import { ok, fail } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

/** 기본 FDC 신호군(대표 아날로그 — 서브시스템별) */
const DEFAULT_SIGNALS = [
  'APC_Pressure',
  'APC_Position',
  'Gas1_Monitor',
  'Gas2_Monitor',
  'SourcePwr_Read',
  'SourcePwr_Reflect',
  'Mat_VPP',
  'Mat_VDC',
  'Wall_Temp_Monitor',
];

/** 베이스라인으로 쓸 앞부분 비율 */
const BASELINE_FRACTION = 0.4;
const MIN_BASELINE = 10;

export async function GET(req: NextRequest) {
  const parsed = fdcQuerySchema.safeParse(searchParamsToObject(req.nextUrl.searchParams));
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => i.message).join(', '));
  }
  const { recipe, stage, step, signals } = parsed.data;
  const useSignals = signals.length > 0 ? signals : DEFAULT_SIGNALS;

  try {
    const { lots, rows, signals: cols } = await getWaferMatrix(
      { recipe, stage, recipeStepNum: step },
      useSignals,
    );

    // NaN(결측) 행 제거, lots 정렬 유지
    const clean: { lot: (typeof lots)[number]; row: number[] }[] = [];
    rows.forEach((row, i) => {
      if (row.every((v) => Number.isFinite(v))) clean.push({ lot: lots[i], row });
    });
    if (clean.length < MIN_BASELINE + 1) {
      return fail(`FDC에 충분한 웨이퍼가 없습니다(유효 ${clean.length}개)`, 422);
    }

    const evalRows = clean.map((c) => c.row);
    const baselineN = Math.max(MIN_BASELINE, Math.floor(clean.length * BASELINE_FRACTION));
    const baselineRows = evalRows.slice(0, baselineN);

    const fdc = runFdc(baselineRows, evalRows, cols);
    return ok({
      context: { recipe, stage, recipeStepNum: step },
      lots: clean.map((c) => c.lot),
      baselineN,
      ...fdc,
    });
  } catch (err) {
    console.error('[api/fdc] 실패:', err);
    return fail('FDC 산출 실패', 500);
  }
}
