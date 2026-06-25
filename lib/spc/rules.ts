/**
 * Western Electric / Nelson 관리도 위반 룰 — 순수 함수.
 *
 * 시그마 존 기준으로 점열을 평가한다. 시그마=0(변동 없음)인 경우 존이
 * 붕괴하므로 룰 평가를 건너뛴다(거짓 양성 방지).
 */

import type { ControlLimits, Violation, WaferPoint } from './types';

/** 점의 시그마 존 부호화: +3=UCL 초과 ... -3=LCL 미만 */
function zoneOf(value: number, limits: ControlLimits): number {
  const { centerLine, sigma } = limits;
  if (sigma === 0) return 0;
  const z = (value - centerLine) / sigma;
  return z;
}

/** WE Rule 1: 1점이 3σ 밖 */
function ruleBeyond3Sigma(zs: number[]): Violation[] {
  const out: Violation[] = [];
  zs.forEach((z, i) => {
    if (Math.abs(z) > 3) {
      out.push({
        index: i,
        rule: 'beyond_3sigma',
        message: '관리한계(3σ)를 벗어남',
        severity: 'alarm',
      });
    }
  });
  return out;
}

/** WE Rule 2: 연속 3점 중 2점이 같은 쪽 2σ 밖 */
function ruleTwoOfThree2Sigma(zs: number[]): Violation[] {
  const out: Violation[] = [];
  for (let i = 2; i < zs.length; i += 1) {
    const w = [zs[i - 2], zs[i - 1], zs[i]];
    for (const sign of [1, -1]) {
      const cnt = w.filter((z) => z * sign > 2).length;
      if (cnt >= 2 && w[2] * sign > 2) {
        out.push({
          index: i,
          rule: 'two_of_three_2sigma',
          message: '연속 3점 중 2점이 2σ 밖(동일 방향)',
          severity: 'warn',
        });
        break;
      }
    }
  }
  return out;
}

/** WE Rule 3: 연속 5점 중 4점이 같은 쪽 1σ 밖 */
function ruleFourOfFive1Sigma(zs: number[]): Violation[] {
  const out: Violation[] = [];
  for (let i = 4; i < zs.length; i += 1) {
    const w = zs.slice(i - 4, i + 1);
    for (const sign of [1, -1]) {
      const cnt = w.filter((z) => z * sign > 1).length;
      if (cnt >= 4 && w[4] * sign > 1) {
        out.push({
          index: i,
          rule: 'four_of_five_1sigma',
          message: '연속 5점 중 4점이 1σ 밖(동일 방향)',
          severity: 'warn',
        });
        break;
      }
    }
  }
  return out;
}

/** WE Rule 4: 연속 8점이 중심선 같은 쪽 */
function ruleEightInRow(zs: number[]): Violation[] {
  const out: Violation[] = [];
  for (let i = 7; i < zs.length; i += 1) {
    const w = zs.slice(i - 7, i + 1);
    if (w.every((z) => z > 0) || w.every((z) => z < 0)) {
      out.push({
        index: i,
        rule: 'eight_in_row_side',
        message: '연속 8점이 중심선 한쪽에 위치',
        severity: 'warn',
      });
    }
  }
  return out;
}

/**
 * 모든 룰을 평가해 위반 목록을 반환한다. 같은 점에 여러 룰이 걸리면
 * 모두 포함한다(인덱스 기준 정렬).
 */
export function detectViolations(
  points: WaferPoint[],
  limits: ControlLimits,
): Violation[] {
  if (limits.sigma === 0 || points.length === 0) return [];
  const zs = points.map((p) => zoneOf(p.value, limits));
  return [
    ...ruleBeyond3Sigma(zs),
    ...ruleTwoOfThree2Sigma(zs),
    ...ruleFourOfFive1Sigma(zs),
    ...ruleEightInRow(zs),
  ].sort((a, b) => a.index - b.index);
}
