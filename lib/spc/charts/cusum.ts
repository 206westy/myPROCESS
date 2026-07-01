/**
 * CUSUM(누적합) 관리도 — 순수 함수.
 *
 * 표준화 편차 기준 양/음 누적합:
 *   C+_t = max(0, C+_{t-1} + (x_t − CL)/σ − k)
 *   C−_t = max(0, C−_{t-1} − (x_t − CL)/σ − k)
 * k=기준이동(보통 0.5σ, 즉 0.5 표준화), H=결정구간(보통 5).
 * |C±| > H 이면 알람. 작은 지속 시프트 누적 탐지에 강하다.
 *
 * statistic 에는 C+ 를, lcl/ucl 에는 ±H 를 담아 시각화한다. C− 위반도
 * 같은 인덱스로 보고한다.
 */

import type { SeriesChart, Violation, WaferPoint, ControlLimits } from './../types';

/** 기준 이동(표준화 단위) */
export const CUSUM_K = 0.5;
/** 결정 구간(표준화 단위) */
export const CUSUM_H = 5;

export interface CusumOptions {
  k?: number;
  h?: number;
}

export function buildCusumChart(
  points: readonly WaferPoint[],
  baselineLimits: ControlLimits,
  opts: CusumOptions = {},
): SeriesChart {
  const k = opts.k ?? CUSUM_K;
  const h = opts.h ?? CUSUM_H;
  const cl = baselineLimits.centerLine;
  const sigma = baselineLimits.sigma;
  const values = points.map((p) => p.value);

  const statistic: number[] = []; // C+ (표준화)
  const cMinus: number[] = [];
  const violations: Violation[] = [];
  let cp = 0;
  let cm = 0;
  for (let t = 0; t < values.length; t += 1) {
    const z = sigma > 0 ? (values[t] - cl) / sigma : 0;
    cp = Math.max(0, cp + z - k);
    cm = Math.max(0, cm - z - k);
    statistic.push(cp);
    cMinus.push(cm);
    if (sigma > 0 && (cp > h || cm > h)) {
      violations.push({
        index: t,
        rule: 'beyond_3sigma',
        message: `CUSUM 누적합이 결정구간(±${h}σ)을 초과(지속 시프트 누적)`,
        severity: 'alarm',
      });
    }
  }

  const ucl = values.map(() => h);
  const lcl = values.map(() => 0);

  return {
    type: 'cusum',
    statistic,
    centerLine: 0,
    ucl,
    lcl,
    violations,
    description: `CUSUM(k=${k}σ, H=${h}σ): 중심선에서의 편차를 누적합니다. 0에서 출발해 H를 넘으면 작은 시프트가 쌓였다는 신호입니다. 표시된 값은 상향 누적합 C+ 이며, 하향 C− 위반도 동일 시점으로 보고됩니다.`,
  };
}
