/**
 * 골든 트레이스 엔벨로프 + 이탈 점수 — 순수 함수.
 *
 * 베이스라인(정상) 웨이퍼들의 스텝 트레이스로 시점별 평균±kσ 엔벨로프를
 * 만든다. 새 웨이퍼 트레이스가 엔벨로프를 벗어나는 정도를 이탈 점수로
 * 산출한다. 길이 차는 선형 리샘플링으로 공통 격자에 맞춘다.
 */

import { mean, sampleStd } from '../spc/stats';

export interface GoldenEnvelope {
  /** 공통 격자 길이 */
  length: number;
  /** 시점별 평균 */
  center: number[];
  /** 시점별 상한(mean + kσ) */
  upper: number[];
  /** 시점별 하한(mean − kσ) */
  lower: number[];
  k: number;
}

/** 트레이스를 길이 L 공통 격자로 선형 리샘플 */
export function resample(trace: readonly number[], length: number): number[] {
  const n = trace.length;
  if (n === 0) return new Array(length).fill(0);
  if (n === 1) return new Array(length).fill(trace[0]);
  const out: number[] = [];
  for (let i = 0; i < length; i += 1) {
    const pos = (i / (length - 1)) * (n - 1);
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    out.push(trace[lo] + (pos - lo) * (trace[hi] - trace[lo]));
  }
  return out;
}

/** 베이스라인 트레이스들로 엔벨로프 생성 */
export function buildEnvelope(
  baselineTraces: readonly (readonly number[])[],
  length: number,
  k = 3,
): GoldenEnvelope {
  const resampled = baselineTraces.map((t) => resample(t, length));
  const center: number[] = [];
  const upper: number[] = [];
  const lower: number[] = [];
  for (let i = 0; i < length; i += 1) {
    const col = resampled.map((r) => r[i]);
    const m = mean(col);
    const s = sampleStd(col);
    center.push(m);
    upper.push(m + k * s);
    lower.push(m - k * s);
  }
  return { length, center, upper, lower, k };
}

export interface DeviationResult {
  /** 엔벨로프 밖 시점 비율(0~1) */
  outOfBandRatio: number;
  /** 평균 초과 폭(σ 단위 근사) */
  meanExcess: number;
  /** 시점별 이탈량(0이면 밴드 안) */
  excess: number[];
  alarm: boolean;
}

/**
 * 새 트레이스의 엔벨로프 이탈 점수. alarmRatio 초과 시 알람.
 */
export function scoreDeviation(
  trace: readonly number[],
  env: GoldenEnvelope,
  alarmRatio = 0.1,
): DeviationResult {
  const r = resample(trace, env.length);
  const excess: number[] = [];
  let outCount = 0;
  let excessSum = 0;
  for (let i = 0; i < env.length; i += 1) {
    let e = 0;
    if (r[i] > env.upper[i]) e = r[i] - env.upper[i];
    else if (r[i] < env.lower[i]) e = env.lower[i] - r[i];
    if (e > 0) {
      outCount += 1;
      excessSum += e;
    }
    excess.push(e);
  }
  const outOfBandRatio = outCount / env.length;
  return {
    outOfBandRatio,
    meanExcess: outCount ? excessSum / outCount : 0,
    excess,
    alarm: outOfBandRatio > alarmRatio,
  };
}
