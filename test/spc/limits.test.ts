import { describe, test, expect } from 'vitest';
import { computeControlLimits, MIN_STABLE_POINTS } from '../../lib/spc/limits';
import type { WaferPoint } from '../../lib/spc/types';

function points(values: number[]): WaferPoint[] {
  return values.map((value, i) => ({
    lot: 'L1',
    waferNo: String(i + 1),
    time: `2026-03-12T00:00:0${i}Z`,
    value,
    std: 0,
    min: value,
    max: value,
    samples: 1,
  }));
}

describe('computeControlLimits', () => {
  test('중심선은 점들의 평균이다', () => {
    // Arrange
    const pts = points([10, 12, 14]);
    // Act
    const limits = computeControlLimits(pts);
    // Assert
    expect(limits.centerLine).toBeCloseTo(12);
  });

  test('이동범위 기반 시그마와 3σ 한계를 계산한다', () => {
    // Arrange: MR = |12-10|,|14-12| = 2,2 → MR_bar=2 → sigma=2/1.128
    const pts = points([10, 12, 14]);
    // Act
    const limits = computeControlLimits(pts);
    // Assert
    const expectedSigma = 2 / 1.128;
    expect(limits.sigma).toBeCloseTo(expectedSigma);
    expect(limits.ucl).toBeCloseTo(12 + 3 * expectedSigma);
    expect(limits.lcl).toBeCloseTo(12 - 3 * expectedSigma);
  });

  test('1σ/2σ 존 경계를 산출한다', () => {
    const pts = points([10, 12, 14]);
    const limits = computeControlLimits(pts);
    const s = limits.sigma;
    expect(limits.zoneUpper1).toBeCloseTo(12 + s);
    expect(limits.zoneUpper2).toBeCloseTo(12 + 2 * s);
    expect(limits.zoneLower1).toBeCloseTo(12 - s);
    expect(limits.zoneLower2).toBeCloseTo(12 - 2 * s);
  });

  test('변동이 없으면 시그마=0, 한계는 중심선과 동일', () => {
    const pts = points([5, 5, 5, 5]);
    const limits = computeControlLimits(pts);
    expect(limits.sigma).toBe(0);
    expect(limits.ucl).toBe(5);
    expect(limits.lcl).toBe(5);
  });

  test('점이 적으면 insufficient 플래그가 true', () => {
    const few = computeControlLimits(points([1, 2, 3]));
    expect(few.insufficient).toBe(true);
    const enough = computeControlLimits(
      points(Array.from({ length: MIN_STABLE_POINTS }, (_, i) => i)),
    );
    expect(enough.insufficient).toBe(false);
  });

  test('컨텍스트가 다르면 동일 패턴이라도 한계가 독립적으로 계산된다', () => {
    // 적응형 SPC의 핵심: 입력 점 집합에만 의존
    const a = computeControlLimits(points([100, 102, 104]));
    const b = computeControlLimits(points([10, 12, 14]));
    expect(a.centerLine).not.toBeCloseTo(b.centerLine);
    expect(a.ucl).toBeGreaterThan(b.ucl);
  });
});
