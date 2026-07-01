/**
 * ARL(평균 런 길이) — 몬테카를로 추정, 순수/결정적(시드).
 *
 *  - ARL₀: 공정이 정상일 때 첫 (거짓)알람까지의 평균 점 수. 클수록 좋음.
 *    표준 3σ Shewhart 이론값 ≈ 370.
 *  - ARL₁: 평균이 deltaSigma 만큼 시프트했을 때 첫 알람까지 평균 점 수.
 *    작을수록 빠른 탐지.
 *
 * 차트별 알람 함수를 주입받아 동일 조건에서 비교한다.
 */

import { normalSeries } from './inject';

/** 시계열을 받아 "첫 알람 인덱스(없으면 -1)"를 반환하는 함수 */
export type FirstAlarmFn = (series: number[]) => number;

export interface ArlEstimate {
  arl: number;
  /** 미탐지(절단) 비율 */
  censoredRatio: number;
  runs: number;
}

/**
 * 몬테카를로 ARL 추정.
 * deltaSigma: 평균 시프트(σ 단위, 0이면 ARL₀).
 * maxLen: 한 런 최대 길이(절단), runs: 반복 수.
 */
export function estimateArl(
  firstAlarm: FirstAlarmFn,
  deltaSigma: number,
  opts: { mu?: number; sigma?: number; maxLen?: number; runs?: number; seed?: number } = {},
): ArlEstimate {
  const mu = opts.mu ?? 0;
  const sigma = opts.sigma ?? 1;
  const maxLen = opts.maxLen ?? 2000;
  const runs = opts.runs ?? 300;
  const seed0 = opts.seed ?? 12345;

  let sum = 0;
  let censored = 0;
  for (let r = 0; r < runs; r += 1) {
    const series = normalSeries(maxLen, mu + deltaSigma * sigma, sigma, seed0 + r * 7919);
    const idx = firstAlarm(series);
    if (idx < 0) {
      sum += maxLen;
      censored += 1;
    } else {
      sum += idx + 1; // 1-기반 런 길이
    }
  }
  return { arl: sum / runs, censoredRatio: censored / runs, runs };
}
