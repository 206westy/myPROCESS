/**
 * 진단: 자기상관·변화점·왜도 — 순수 함수.
 *
 * 차트 추천과 한계 신뢰 판단의 근거를 만든다.
 *  - lag-1 자기상관 ρ1: |ρ1| > 2/√n 이면 유의(독립성 가정 위배).
 *  - 변화점: 누적합(CUSUM-of-mean) 절댓값 최대 위치(레벨 시프트 후보).
 *  - 왜도: 정규성 거친 판단(|skew|>1 이면 비대칭 강함).
 */

import { autocorrelation, mean, sampleStd } from './stats';
import type { Diagnostics } from './types';

/** 자기상관 유의 판정 임계(대략적 95% 신뢰: 2/√n) */
function autocorrThreshold(n: number): number {
  return n > 0 ? 2 / Math.sqrt(n) : Infinity;
}

/** 누적합 기반 단일 변화점 추정(없으면 null) */
function findChangePoint(values: readonly number[]): number | null {
  const n = values.length;
  if (n < 4) return null;
  const m = mean(values);
  let cum = 0;
  let maxAbs = 0;
  let idx = -1;
  for (let i = 0; i < n; i += 1) {
    cum += values[i] - m;
    if (Math.abs(cum) > maxAbs) {
      maxAbs = Math.abs(cum);
      idx = i;
    }
  }
  // 누적합 진폭이 전체 변동 대비 의미 있을 때만 변화점으로 인정
  const sd = sampleStd(values);
  if (sd === 0 || maxAbs < sd) return null;
  return idx;
}

/** 왜도(표본, 3차 적률) */
function skewness(values: readonly number[]): number {
  const n = values.length;
  if (n < 3) return 0;
  const m = mean(values);
  const sd = sampleStd(values);
  if (sd === 0) return 0;
  const s3 = values.reduce((acc, x) => acc + Math.pow((x - m) / sd, 3), 0);
  return (n / ((n - 1) * (n - 2))) * s3;
}

export function diagnose(values: readonly number[]): Diagnostics {
  const lag1 = autocorrelation(values, 1);
  const thr = autocorrThreshold(values.length);
  return {
    lag1Autocorr: lag1,
    autocorrSignificant: Math.abs(lag1) > thr,
    changePointIndex: findChangePoint(values),
    skewness: skewness(values),
  };
}
