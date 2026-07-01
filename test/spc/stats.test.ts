import { describe, test, expect } from 'vitest';
import {
  mean,
  sampleStd,
  movingRangeBar,
  sigmaFromMovingRange,
  quantile,
  median,
  autocorrelation,
  linearFitByIndex,
  ar1Fit,
  D2_N2,
} from '../../lib/spc/stats';

describe('stats 기본 통계', () => {
  test('mean은 평균, 빈 배열은 NaN', () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(Number.isNaN(mean([]))).toBe(true);
  });

  test('sampleStd는 n-1 표준편차', () => {
    // [2,4,6] 분산 = ((−2)²+0+2²)/2 = 4 → std=2
    expect(sampleStd([2, 4, 6])).toBeCloseTo(2);
  });

  test('movingRangeBar와 sigmaFromMovingRange', () => {
    // MR = 2,2 → MR_bar=2 → sigma = 2/1.128
    expect(movingRangeBar([10, 12, 14])).toBeCloseTo(2);
    expect(sigmaFromMovingRange([10, 12, 14])).toBeCloseTo(2 / D2_N2);
  });

  test('quantile/median 선형보간', () => {
    expect(median([1, 2, 3, 4])).toBeCloseTo(2.5);
    expect(quantile([0, 10], 0.5)).toBeCloseTo(5);
  });
});

describe('autocorrelation', () => {
  test('완전 단조 증가 수열은 양의 lag-1 자기상관', () => {
    const xs = Array.from({ length: 20 }, (_, i) => i);
    expect(autocorrelation(xs, 1)).toBeGreaterThan(0.7);
  });

  test('점이 부족하면 0', () => {
    expect(autocorrelation([1, 2], 1)).toBe(0);
  });
});

describe('linearFitByIndex', () => {
  test('기울기/절편을 정확히 복원', () => {
    // y = 3x + 5
    const ys = [5, 8, 11, 14];
    const fit = linearFitByIndex(ys);
    expect(fit.slope).toBeCloseTo(3);
    expect(fit.intercept).toBeCloseTo(5);
    fit.residuals.forEach((r) => expect(r).toBeCloseTo(0));
  });
});

describe('ar1Fit', () => {
  test('첫 잔차는 0, φ는 자기상관과 일치', () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8];
    const fit = ar1Fit(xs);
    expect(fit.residuals[0]).toBe(0);
    expect(fit.phi).toBeCloseTo(autocorrelation(xs, 1));
  });
});
