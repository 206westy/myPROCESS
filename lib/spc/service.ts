/**
 * SPC 서비스 — 데이터 조회 + 적응형 한계 산출 + 위반 탐지를 결합해
 * 관리도 1건의 완성 결과를 만든다.
 */

import { getWaferPoints } from '../data/queries';
import { computeControlLimits } from './limits';
import { detectViolations } from './rules';
import type { ControlChartResult, SpcContext } from './types';

/** 한 컨텍스트×신호의 컨텍스트 적응형 관리도 결과를 산출 */
export async function buildControlChart(
  context: SpcContext,
  signal: string,
): Promise<ControlChartResult> {
  const points = await getWaferPoints(context, signal);
  const limits = computeControlLimits(points);
  const violations = detectViolations(points, limits);
  return { context, signal, points, limits, violations };
}
