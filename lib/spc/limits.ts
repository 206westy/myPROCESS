/**
 * 컨텍스트 적응형 관리한계 산출 — 순수 함수.
 *
 * 개별값(Individuals, I-MR) 관리도를 사용한다. 관리도 1점 = 한 웨이퍼
 * 런의 신호 집계값이며, 한 컨텍스트(Recipe×Stage×Step)당 표본 크기는
 * 1(웨이퍼당 1점)이므로 표준편차를 직접 쓰지 않고 **이동범위(MR) 기반
 * 시그마 추정**을 사용한다: sigma = MR_bar / d2,  d2(n=2) = 1.128.
 *
 * 핵심: 이 한계는 입력으로 들어온 "해당 컨텍스트의 점들"로부터만
 * 계산된다. 전역 상수 한계는 절대 사용하지 않는다.
 */

import type { ControlLimits, WaferPoint } from './types';

/** I-MR 차트의 d2 상수(연속 2점 이동범위 기준) */
const D2_N2 = 1.128;
/** 3σ 관리한계 계수 */
const SIGMA_K = 3;
/** 통계적으로 안정적인 한계로 보기 위한 최소 점 개수 */
export const MIN_STABLE_POINTS = 8;

function mean(xs: number[]): number {
  if (xs.length === 0) return Number.NaN;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** 연속 점들의 이동범위 평균(MR_bar) */
function movingRangeBar(values: number[]): number {
  if (values.length < 2) return 0;
  const ranges: number[] = [];
  for (let i = 1; i < values.length; i += 1) {
    ranges.push(Math.abs(values[i] - values[i - 1]));
  }
  return mean(ranges);
}

/**
 * 웨이퍼 점들로부터 컨텍스트 적응형 관리한계를 산출한다.
 * 점이 비어 있으면 NaN 한계를 반환하지 않도록 호출 측에서 가드한다.
 */
export function computeControlLimits(points: WaferPoint[]): ControlLimits {
  const values = points.map((p) => p.value);
  const n = values.length;
  const centerLine = mean(values);
  const mrBar = movingRangeBar(values);
  const sigma = mrBar / D2_N2;

  const k = (mult: number) => centerLine + mult * sigma;

  return {
    centerLine,
    sigma,
    ucl: k(SIGMA_K),
    lcl: k(-SIGMA_K),
    zoneUpper1: k(1),
    zoneUpper2: k(2),
    zoneLower1: k(-1),
    zoneLower2: k(-2),
    n,
    insufficient: n < MIN_STABLE_POINTS,
  };
}
