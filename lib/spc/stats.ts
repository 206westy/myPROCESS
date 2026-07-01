/**
 * 공유 순수 통계 유틸 — SPC/FDC/벤치마크 모든 모듈의 단일 출처(DRY).
 *
 * 모든 함수는 부수효과 없는 순수 함수다. 빈 입력/표본 부족은 NaN/0으로
 * 안전하게 반환하고, 호출 측에서 의미를 부여한다.
 */

/** I-MR 차트의 d2 상수(연속 2점 이동범위 기준). sigma = MR_bar / d2 */
export const D2_N2 = 1.128;
/** 표준 3σ 관리한계 계수 */
export const SIGMA_K = 3;

/** 산술 평균. 빈 배열이면 NaN */
export function mean(xs: readonly number[]): number {
  if (xs.length === 0) return Number.NaN;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** 표본 분산(n-1). 점이 2개 미만이면 0 */
export function sampleVariance(xs: readonly number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const ss = xs.reduce((acc, x) => acc + (x - m) * (x - m), 0);
  return ss / (xs.length - 1);
}

/** 표본 표준편차(n-1) */
export function sampleStd(xs: readonly number[]): number {
  return Math.sqrt(sampleVariance(xs));
}

/** 연속 점들의 이동범위 |x_i − x_{i-1}| 배열 */
export function movingRanges(values: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < values.length; i += 1) {
    out.push(Math.abs(values[i] - values[i - 1]));
  }
  return out;
}

/** 이동범위 평균(MR_bar). 점이 2개 미만이면 0 */
export function movingRangeBar(values: readonly number[]): number {
  const ranges = movingRanges(values);
  return ranges.length === 0 ? 0 : mean(ranges);
}

/**
 * 이동범위 기반 단기(그룹내) 시그마 추정: MR_bar / d2.
 * I-MR 관리도에서 한계 산출에 쓰는 "공정의 단기 변동" 추정치.
 */
export function sigmaFromMovingRange(values: readonly number[]): number {
  return movingRangeBar(values) / D2_N2;
}

/**
 * 선형 보간 분위수(0~1). 빈 배열이면 NaN.
 * type-7(R 기본) 방식.
 */
export function quantile(xs: readonly number[], p: number): number {
  if (xs.length === 0) return Number.NaN;
  if (xs.length === 1) return xs[0];
  const sorted = [...xs].sort((a, b) => a - b);
  const h = (sorted.length - 1) * Math.min(Math.max(p, 0), 1);
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

/** 중앙값 */
export function median(xs: readonly number[]): number {
  return quantile(xs, 0.5);
}

/**
 * 표본 자기상관계수 ρ_k (lag k). 점이 lag+2 미만이면 0.
 * ρ_1 이 0과 유의하게 다르면 I-MR 가정(독립성)이 깨진 것.
 */
export function autocorrelation(xs: readonly number[], lag = 1): number {
  const n = xs.length;
  if (n < lag + 2) return 0;
  const m = mean(xs);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    den += (xs[i] - m) * (xs[i] - m);
  }
  for (let i = lag; i < n; i += 1) {
    num += (xs[i] - m) * (xs[i - lag] - m);
  }
  return den === 0 ? 0 : num / den;
}

export interface LinearFit {
  /** 기울기 */
  slope: number;
  /** 절편 */
  intercept: number;
  /** 각 점의 적합값 yhat_i */
  fitted: number[];
  /** 각 점의 잔차 y_i − yhat_i */
  residuals: number[];
}

/**
 * 단순 선형회귀 y = slope·x + intercept (x = 인덱스 0..n-1).
 * 드리프트(추세) 제거용 — 잔차 관리도의 기반.
 */
export function linearFitByIndex(ys: readonly number[]): LinearFit {
  const n = ys.length;
  if (n === 0) return { slope: 0, intercept: 0, fitted: [], residuals: [] };
  if (n === 1) return { slope: 0, intercept: ys[0], fitted: [ys[0]], residuals: [0] };
  const xbar = (n - 1) / 2;
  const ybar = mean(ys);
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i += 1) {
    sxy += (i - xbar) * (ys[i] - ybar);
    sxx += (i - xbar) * (i - xbar);
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = ybar - slope * xbar;
  const fitted = ys.map((_, i) => intercept + slope * i);
  const residuals = ys.map((y, i) => y - fitted[i]);
  return { slope, intercept, fitted, residuals };
}

/**
 * AR(1) 계수 φ 추정과 한 스텝 예측 잔차.
 * 자기상관 공정에서 잔차(=백색잡음 근사)에 관리도를 적용하기 위함.
 * 반환 residuals[0] = 0(첫 점은 예측 불가).
 */
export interface Ar1Fit {
  phi: number;
  intercept: number;
  residuals: number[];
}

export function ar1Fit(xs: readonly number[]): Ar1Fit {
  const n = xs.length;
  if (n < 3) return { phi: 0, intercept: mean(xs) || 0, residuals: xs.map(() => 0) };
  const phi = autocorrelation(xs, 1);
  const m = mean(xs);
  // x_t - m = phi (x_{t-1} - m) + e_t  →  intercept = m(1-phi)
  const intercept = m * (1 - phi);
  const residuals = xs.map((x, i) => {
    if (i === 0) return 0;
    const pred = intercept + phi * xs[i - 1];
    return x - pred;
  });
  return { phi, intercept, residuals };
}

/**
 * 피어슨 상관계수 r. 길이 불일치/표본 부족/분산 0이면 NaN.
 * 지표 ↔ 수율 상관 분석의 기반.
 */
export function pearson(xs: readonly number[], ys: readonly number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return Number.NaN;
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  const denom = Math.sqrt(sxx * syy);
  return denom === 0 ? Number.NaN : sxy / denom;
}

/** 값이 유한한 수인지 */
export function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
