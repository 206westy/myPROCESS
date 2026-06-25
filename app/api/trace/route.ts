/**
 * GET /api/trace?lot=&wafer=&step=&signals=a,b,c
 * 한 (Lot×Wafer×Step)의 고주파 트레이스(선택 신호 다중).
 */

import { type NextRequest } from 'next/server';
import { getTrace, assertSignal } from '@/lib/data/queries';
import { traceQuerySchema, searchParamsToObject } from '@/lib/validation';
import { ok, fail } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

/** 한 번에 오버레이할 수 있는 신호 수 상한 */
const MAX_SIGNALS = 6;

export async function GET(req: NextRequest) {
  const parsed = traceQuerySchema.safeParse(
    searchParamsToObject(req.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => i.message).join(', '));
  }

  const { lot, wafer, step, signals } = parsed.data;
  if (signals.length > MAX_SIGNALS) {
    return fail(`신호는 최대 ${MAX_SIGNALS}개까지 선택할 수 있습니다`);
  }

  try {
    signals.forEach(assertSignal); // 화이트리스트 검증(인젝션 방지)
  } catch {
    return fail('알 수 없는 신호명이 포함되어 있습니다');
  }

  try {
    const trace = await getTrace(lot, wafer, step, signals);
    return ok(trace);
  } catch (err) {
    console.error('[api/trace] 실패:', err);
    return fail('트레이스 조회 실패', 500);
  }
}
