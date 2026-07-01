import { describe, test, expect } from 'vitest';
import { computeTrustScore } from '../../lib/spc/variance';

describe('computeTrustScore (한계 신뢰도)', () => {
  test('안정 공정: within≈total → 신뢰 높음', () => {
    // 작은 무작위 변동, 드리프트 없음
    const values = [10, 10.2, 9.9, 10.1, 10.0, 9.8, 10.2, 10.1];
    const t = computeTrustScore(values);
    expect(t.ratio).toBeLessThan(1.5);
    expect(t.grade).toBe('high');
  });

  test('드리프트/이질 모집단: total≫within → 신뢰 낮음(경고)', () => {
    // 인접 점은 비슷(작은 MR)하나 전체적으로 큰 레벨차(두 군집)
    const values = [10, 10.1, 10.0, 10.1, 20, 20.1, 20.0, 20.1];
    const t = computeTrustScore(values);
    expect(t.ratio).toBeGreaterThan(3);
    expect(t.grade).toBe('low');
    expect(t.explanation).toContain('낮음');
  });

  test('완전 일정: ratio=1, 신뢰 높음', () => {
    const t = computeTrustScore([5, 5, 5, 5]);
    expect(t.ratio).toBe(1);
    expect(t.grade).toBe('high');
  });
});
