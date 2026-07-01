/**
 * 수율 브리지 순수 로직 테스트 — Pearson 상관 + 응답 컬럼 화이트리스트.
 */

import { describe, it, expect } from 'vitest';
import { pearson } from '../../lib/spc/stats';
import { assertQualityResponse } from '../../lib/yield/schema';

describe('pearson', () => {
  it('완전 양의 상관 = 1', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 10);
  });
  it('완전 음의 상관 = -1', () => {
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 10);
  });
  it('분산 0이면 NaN', () => {
    expect(Number.isNaN(pearson([5, 5, 5], [1, 2, 3]))).toBe(true);
  });
  it('표본 부족(<3)이면 NaN', () => {
    expect(Number.isNaN(pearson([1, 2], [3, 4]))).toBe(true);
  });
});

describe('assertQualityResponse', () => {
  it('허용 응답만 통과(인젝션 가드)', () => {
    expect(assertQualityResponse('yield_pct')).toBe('yield_pct');
    expect(assertQualityResponse('defect_count')).toBe('defect_count');
    expect(() => assertQualityResponse('lot; DROP TABLE x;--')).toThrow();
  });
});
