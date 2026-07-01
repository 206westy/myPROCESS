/**
 * 베이스라인(골든) 선정 + 동결 한계 — 순수 함수.
 *
 * 정통 SPC: 공정이 안정했던 기준 구간에서 한계를 1회 산출해 "동결"하고,
 * 이후 데이터를 그 고정 한계에 비춰 본다. 매 런 전체 데이터로 재계산하면
 * 불량/드리프트가 한계를 오염시켜 의미가 사라진다.
 *
 * 자동 선정 전략(라벨 없는 데이터 기준):
 *  - 가장 단기 변동이 작은 연속 구간(저변동 윈도)을 골든으로 본다.
 *  - 최소 길이 미만이면 전체를 베이스라인으로 사용(insufficient).
 */

import { computeControlLimits } from './limits';
import { movingRanges, mean } from './stats';
import { MIN_STABLE_POINTS } from './limits';
import type { BaselineRef, ControlLimits, WaferPoint } from './types';

/** 골든 윈도 탐색 시 한 번에 보는 최소 구간 길이 */
const WINDOW = MIN_STABLE_POINTS;

/**
 * 연속 저변동 윈도를 찾아 베이스라인 인덱스를 고른다.
 * 각 길이-WINDOW 윈도의 이동범위 평균이 최소인 구간을 선택.
 */
export function selectBaseline(values: readonly number[]): BaselineRef {
  const n = values.length;
  if (n < WINDOW) {
    return {
      indices: values.map((_, i) => i),
      n,
      method: `점 부족(${n}<${WINDOW}) — 전체를 베이스라인으로 사용(통계 불안정)`,
    };
  }

  let bestStart = 0;
  let bestMr = Number.POSITIVE_INFINITY;
  for (let start = 0; start + WINDOW <= n; start += 1) {
    const win = values.slice(start, start + WINDOW);
    const mr = movingRanges(win);
    const mrBar = mr.length ? mean(mr) : 0;
    if (mrBar < bestMr) {
      bestMr = mrBar;
      bestStart = start;
    }
  }
  const indices = Array.from({ length: WINDOW }, (_, i) => bestStart + i);
  return {
    indices,
    n: WINDOW,
    method: `최저변동 연속 ${WINDOW}점 윈도(인덱스 ${bestStart}~${bestStart + WINDOW - 1})를 골든 베이스라인으로 동결`,
  };
}

/**
 * 베이스라인 점들로부터 한계를 산출(동결). 이후 전체 점은 이 한계로 평가.
 */
export function computeBaselineLimits(
  points: readonly WaferPoint[],
  baseline: BaselineRef,
): ControlLimits {
  const basePoints = baseline.indices.map((i) => points[i]).filter(Boolean);
  return computeControlLimits(basePoints);
}
