import { describe, test, expect } from 'vitest';
import { detectViolations } from '../../lib/spc/rules';
import type { ControlLimits, WaferPoint } from '../../lib/spc/types';

/** 중심선 0, 시그마 1인 고정 한계(룰 평가 단순화) */
const limits: ControlLimits = {
  centerLine: 0,
  sigma: 1,
  ucl: 3,
  lcl: -3,
  zoneUpper1: 1,
  zoneUpper2: 2,
  zoneLower1: -1,
  zoneLower2: -2,
  n: 0,
  insufficient: false,
};

function points(values: number[]): WaferPoint[] {
  return values.map((value, i) => ({
    lot: 'L1',
    waferNo: String(i + 1),
    time: `t${i}`,
    value,
    std: 0,
    min: value,
    max: value,
    samples: 1,
  }));
}

describe('detectViolations', () => {
  test('Rule 1: 3σ 밖 점을 alarm으로 탐지', () => {
    const v = detectViolations(points([0, 0, 3.5, 0]), limits);
    expect(v.some((x) => x.rule === 'beyond_3sigma' && x.index === 2)).toBe(true);
    expect(v.find((x) => x.rule === 'beyond_3sigma')?.severity).toBe('alarm');
  });

  test('Rule 2: 연속 3점 중 2점 2σ 밖(동일 방향) 탐지', () => {
    const v = detectViolations(points([0, 2.3, 2.4]), limits);
    expect(v.some((x) => x.rule === 'two_of_three_2sigma')).toBe(true);
  });

  test('Rule 3: 연속 5점 중 4점 1σ 밖(동일 방향) 탐지', () => {
    const v = detectViolations(points([1.2, 1.3, 0, 1.4, 1.5]), limits);
    expect(v.some((x) => x.rule === 'four_of_five_1sigma')).toBe(true);
  });

  test('Rule 4: 연속 8점 한쪽 탐지', () => {
    const v = detectViolations(points([0.1, 0.2, 0.3, 0.1, 0.2, 0.3, 0.1, 0.2]), limits);
    expect(v.some((x) => x.rule === 'eight_in_row_side')).toBe(true);
  });

  test('관리상태 데이터는 위반 없음', () => {
    const v = detectViolations(points([0.1, -0.1, 0.2, -0.2, 0.05]), limits);
    expect(v).toHaveLength(0);
  });

  test('시그마=0이면 룰 평가를 건너뛴다(거짓 양성 방지)', () => {
    const flat: ControlLimits = { ...limits, sigma: 0 };
    const v = detectViolations(points([5, 5, 5, 5]), flat);
    expect(v).toHaveLength(0);
  });
});
