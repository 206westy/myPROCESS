import { describe, test, expect } from 'vitest';
import { computeControlLimits } from '../../lib/spc/limits';
import { buildEwmaChart } from '../../lib/spc/charts/ewma';
import { buildCusumChart } from '../../lib/spc/charts/cusum';
import { buildResidualChart } from '../../lib/spc/charts/residual';
import { selectBaseline, computeBaselineLimits } from '../../lib/spc/baseline';
import { normalSeries } from '../../lib/bench/inject';
import type { WaferPoint } from '../../lib/spc/types';

function pts(values: number[]): WaferPoint[] {
  return values.map((value, i) => ({
    lot: 'L',
    waferNo: String(i),
    time: '',
    value,
    std: 0,
    min: value,
    max: value,
    samples: 1,
  }));
}

// 안정 구간(평균 10, 작은 잡음) 30점 + 시프트 구간(평균 13, 같은 잡음) 20점.
// 잡음을 둬 "상수 구간이 최저변동으로 잘못 선택되는" 퇴화를 피한다.
const STABLE = normalSeries(30, 10, 0.2, 100);
const SHIFTED = [...STABLE, ...normalSeries(20, 13, 0.2, 200)];
// 베이스라인은 명백히 깨끗한 사전 구간(첫 30점)으로 고정해 차트를 검증
const CLEAN_BASE = computeControlLimits(pts(STABLE));

describe('베이스라인 동결', () => {
  test('저변동 구간을 골든으로 선택(시프트 이전, 중심선 10 근처)', () => {
    // 시프트 이후 구간이 더 변동이 크도록 꼬리에 큰 진동 추가
    const series = [...STABLE, ...Array.from({ length: 20 }, (_, i) => (i % 2 ? 6 : 18))];
    const points = pts(series);
    const base = selectBaseline(series);
    const limits = computeBaselineLimits(points, base);
    expect(limits.centerLine).toBeCloseTo(10, 0);
    expect(base.n).toBeGreaterThan(0);
  });
});

describe('EWMA 차트', () => {
  test('시프트 후 통계량이 시변 한계를 벗어난다', () => {
    const points = pts(SHIFTED);
    const chart = buildEwmaChart(points, CLEAN_BASE);
    expect(chart.type).toBe('ewma');
    expect(chart.statistic.length).toBe(SHIFTED.length);
    expect(chart.violations.some((v) => v.index >= 30)).toBe(true);
  });
});

describe('CUSUM 차트', () => {
  test('지속 시프트를 누적 탐지', () => {
    const points = pts(SHIFTED);
    const chart = buildCusumChart(points, CLEAN_BASE);
    expect(chart.violations.some((v) => v.index >= 30)).toBe(true);
  });
});

describe('잔차 차트', () => {
  test('통계량 길이와 중심선 0', () => {
    const chart = buildResidualChart(pts(STABLE));
    expect(chart.centerLine).toBe(0);
    expect(chart.statistic.length).toBe(STABLE.length);
  });
});

describe('동결 한계는 정적 재계산과 다르다', () => {
  test('시프트 데이터에서 동결 한계가 더 좁다(오염 방지)', () => {
    const points = pts(SHIFTED);
    const naive = computeControlLimits(points);
    expect(CLEAN_BASE.sigma).toBeLessThan(naive.sigma);
  });
});
