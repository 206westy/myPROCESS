/**
 * SPC 서비스 — 데이터 조회 + 적응형 분석 조립.
 */

import {
  getWaferPoints,
  getWaferPointsByIndicator,
  getSetpointValues,
  assertSignal,
} from '../data/queries';
import { SIGNAL_COLUMNS } from '../csv/columns';
import { DEFAULT_INDICATOR } from '../indicators/catalog';
import { computeControlLimits } from './limits';
import { detectViolations } from './rules';
import { buildAdaptiveSpc } from './adaptive';
import type { AdaptiveSpcResult, ControlChartResult, SpcContext } from './types';

const SIGNAL_SET = new Set<string>(SIGNAL_COLUMNS);

/** 신호의 짝 setpoint 신호명을 추정(예: Gas2_Monitor→Gas2_Set, X_Read→X_Set) */
export function guessSetpointSignal(signal: string): string | null {
  const candidates = [
    signal.replace(/_Monitor$/i, '_Set'),
    signal.replace(/_Read$/i, '_Set'),
    signal.replace(/_Monitor$/i, '_SetPoint'),
    `${signal}_Set`,
  ];
  for (const c of candidates) {
    if (c !== signal && SIGNAL_SET.has(c)) return c;
  }
  return null;
}

/**
 * 컨텍스트×신호×지표의 웨이퍼 점 조회.
 * indicator='mean'은 레거시 경로(trace 평균)로 지표 테이블 없이도 동작.
 * 그 외 지표는 사전계산된 wafer_step_indicators에서 조회.
 */
async function loadPoints(
  context: SpcContext,
  signal: string,
  indicator: string,
) {
  return indicator === DEFAULT_INDICATOR
    ? getWaferPoints(context, signal)
    : getWaferPointsByIndicator(context, signal, indicator);
}

/** 한 컨텍스트×신호의 (레거시) 단순 I-MR 관리도 */
export async function buildControlChart(
  context: SpcContext,
  signal: string,
): Promise<ControlChartResult> {
  const points = await getWaferPoints(context, signal);
  const limits = computeControlLimits(points);
  const violations = detectViolations(points, limits);
  return { context, signal, points, limits, violations };
}

/** 한 컨텍스트×신호의 적응형 SPC(베이스라인 동결+추천 차트+규격+신뢰도) */
export async function buildAdaptiveControlChart(
  context: SpcContext,
  signal: string,
  indicator: string = DEFAULT_INDICATOR,
): Promise<AdaptiveSpcResult> {
  const points = await loadPoints(context, signal, indicator);
  const setpointSignal = guessSetpointSignal(signal);
  let setpointValues: number[] | undefined;
  if (setpointSignal) {
    try {
      assertSignal(setpointSignal);
      setpointValues = await getSetpointValues(context, setpointSignal);
    } catch {
      setpointValues = undefined;
    }
  }
  const result = buildAdaptiveSpc(context, signal, points, {
    setpointValues,
    setpointSignal: setpointSignal ?? undefined,
  });
  return { ...result, indicator };
}
