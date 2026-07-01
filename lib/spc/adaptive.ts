/**
 * 적응형 SPC 오케스트레이터 — 순수 조립.
 *
 * 웨이퍼 점 + (선택)setpoint 값으로부터 AdaptiveSpcResult를 만든다:
 * 베이스라인 동결 한계 → Trust Score → 진단 → 차트 추천 → 추천 차트 시리즈
 * → 규격/공정능력 → 위반. 데이터 조회는 호출 측에서.
 */

import { detectViolations } from './rules';
import { selectBaseline, computeBaselineLimits } from './baseline';
import { computeTrustScore } from './variance';
import { diagnose } from './autocorr';
import { recommendChart } from './recommend';
import { buildEwmaChart } from './charts/ewma';
import { buildCusumChart } from './charts/cusum';
import { buildResidualChart } from './charts/residual';
import { deriveSpecFromSetpoint, manualSpec, computeCapability } from './spec';
import type {
  AdaptiveSpcResult,
  ChartType,
  ControlLimits,
  SeriesChart,
  SpcContext,
  WaferPoint,
} from './types';

function buildChart(
  type: ChartType,
  points: readonly WaferPoint[],
  baseLimits: ControlLimits,
): SeriesChart {
  switch (type) {
    case 'ewma':
      return buildEwmaChart(points, baseLimits);
    case 'cusum':
      return buildCusumChart(points, baseLimits);
    case 'residual':
      return buildResidualChart(points);
    case 'imr':
    default: {
      // I-MR은 개별값을 그대로 통계량으로, 동결 한계를 고정폭으로 표현
      const statistic = points.map((p) => p.value);
      return {
        type: 'imr',
        statistic,
        centerLine: baseLimits.centerLine,
        ucl: statistic.map(() => baseLimits.ucl),
        lcl: statistic.map(() => baseLimits.lcl),
        violations: detectViolations([...points], baseLimits),
        description: `I-MR(개별값): 각 웨이퍼 값을 동결 한계(CL=${baseLimits.centerLine.toFixed(3)})에 직접 비춥니다.`,
      };
    }
  }
}

export interface AdaptiveOptions {
  /** setpoint 신호 값(규격 유도용). 없으면 규격 null */
  setpointValues?: number[];
  setpointSignal?: string;
  /** 수동 규격(우선 적용) */
  manualSpec?: { target: number | null; usl: number | null; lsl: number | null };
}

export function buildAdaptiveSpc(
  context: SpcContext,
  signal: string,
  points: WaferPoint[],
  opts: AdaptiveOptions = {},
): AdaptiveSpcResult {
  const values = points.map((p) => p.value);

  // 1) 베이스라인 동결 한계
  const baseline = selectBaseline(values);
  const limits = computeBaselineLimits(points, baseline);

  // 2) 신뢰도 + 진단 + 추천
  const trust = computeTrustScore(values);
  const diagnostics = diagnose(values);
  const recommendation = recommendChart(diagnostics, trust);

  // 3) 추천 차트 시리즈(동결 한계 기준)
  const chart = buildChart(recommendation.recommended, points, limits);

  // 4) 규격 + 공정능력
  const spec = opts.manualSpec
    ? manualSpec(opts.manualSpec.target, opts.manualSpec.usl, opts.manualSpec.lsl)
    : opts.setpointValues
      ? deriveSpecFromSetpoint(opts.setpointValues, opts.setpointSignal ?? 'setpoint')
      : { target: null, usl: null, lsl: null, source: '미설정' };
  const capability = computeCapability(values, spec);

  // 5) 기준선(I-MR 동결) 위반 — 개별값 가시성
  const violations = detectViolations(points, limits);

  return {
    context,
    signal,
    points,
    limits,
    baseline,
    trust,
    diagnostics,
    recommendation,
    chart,
    spec,
    capability,
    violations,
  };
}
