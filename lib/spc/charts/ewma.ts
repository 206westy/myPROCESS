/**
 * EWMA 관리도 — 순수 함수.
 *
 * z_t = λ·x_t + (1−λ)·z_{t-1},  z_0 = CL(베이스라인 평균)
 * 한계는 시변: CL ± L·σ·sqrt( λ/(2−λ) · (1−(1−λ)^{2t}) )
 *
 * 작은 평균 시프트(<1.5σ)에 Shewhart보다 빠르게 반응한다(메모리 효과).
 * 한계용 σ는 베이스라인 동결 σ_within을 쓴다(전역 상수 아님).
 */

import type { SeriesChart, Violation, WaferPoint, ControlLimits } from './../types';

/** EWMA 평활계수(작은 시프트 민감) */
export const EWMA_LAMBDA = 0.2;
/** EWMA 한계 폭 계수 */
export const EWMA_L = 3;

export interface EwmaOptions {
  lambda?: number;
  L?: number;
}

/**
 * 베이스라인 동결 한계(centerLine, sigma)를 기준으로 전체 점에 EWMA 적용.
 */
export function buildEwmaChart(
  points: readonly WaferPoint[],
  baselineLimits: ControlLimits,
  opts: EwmaOptions = {},
): SeriesChart {
  const lambda = opts.lambda ?? EWMA_LAMBDA;
  const L = opts.L ?? EWMA_L;
  const cl = baselineLimits.centerLine;
  const sigma = baselineLimits.sigma;
  const values = points.map((p) => p.value);

  const statistic: number[] = [];
  const ucl: number[] = [];
  const lcl: number[] = [];
  let z = cl;
  for (let t = 0; t < values.length; t += 1) {
    z = lambda * values[t] + (1 - lambda) * z;
    statistic.push(z);
    const varFactor =
      (lambda / (2 - lambda)) * (1 - Math.pow(1 - lambda, 2 * (t + 1)));
    const halfWidth = L * sigma * Math.sqrt(varFactor);
    ucl.push(cl + halfWidth);
    lcl.push(cl - halfWidth);
  }

  const violations: Violation[] = [];
  if (sigma > 0) {
    for (let i = 0; i < statistic.length; i += 1) {
      if (statistic[i] > ucl[i] || statistic[i] < lcl[i]) {
        violations.push({
          index: i,
          rule: 'beyond_3sigma',
          message: 'EWMA 통계량이 시변 한계를 벗어남(작은 시프트 신호)',
          severity: 'alarm',
        });
      }
    }
  }

  return {
    type: 'ewma',
    statistic,
    centerLine: cl,
    ucl,
    lcl,
    violations,
    description: `EWMA(λ=${lambda}, L=${L}): 최근 값에 가중치를 둔 누적 평균. 작은 지속 시프트를 빠르게 잡습니다. 한계는 베이스라인 단기 σ=${sigma.toExponential(2)} 기준이며 초반에 좁다가 점차 안정폭으로 넓어집니다.`,
  };
}
