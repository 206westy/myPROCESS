/**
 * Commonality 순수 분석 테스트 — 이상치 표시 + ratio-gap 순위.
 */

import { describe, it, expect } from 'vitest';
import {
  markAnomalies,
  commonality,
  medianAbsoluteDeviation,
  type CommonalityRow,
} from '../../lib/commonality/analyze';

describe('markAnomalies', () => {
  it('컨텍스트 내 로버스트 이상치를 표시한다', () => {
    // ctxA: 10 부근 정상값 9개(변동 존재) + 1000 한 개(명백한 이상치)
    const normal = [10, 11, 9, 10, 12, 8, 11, 9, 10];
    const rows: CommonalityRow[] = [
      ...normal.map((v) => ({ contextKey: 'A', value: v, dimensions: {} })),
      { contextKey: 'A', value: 1000, dimensions: {} },
    ];
    const marked = markAnomalies(rows, 3.5);
    expect(marked.filter((m) => m.isBad)).toHaveLength(1);
    expect(marked.find((m) => m.value === 1000)?.isBad).toBe(true);
  });

  it('MAD=0(변동 없음)이면 이상 없음(거짓양성 방지)', () => {
    const rows: CommonalityRow[] = Array.from({ length: 5 }, () => ({
      contextKey: 'A', value: 7, dimensions: {},
    }));
    expect(markAnomalies(rows).every((m) => !m.isBad)).toBe(true);
  });

  it('MAD 계산이 정확하다', () => {
    expect(medianAbsoluteDeviation([1, 2, 3, 4, 5])).toBe(1); // median=3, dev=[2,1,0,1,2]→median 1
  });
});

describe('commonality', () => {
  it('이상이 몰린 챔버를 과대표집으로 순위화한다', () => {
    // 챔버 B에 이상이 집중되도록 구성
    const rows: CommonalityRow[] = [];
    // ctx X: 정상 9개(챔버 A) + 이상 1개(챔버 B)
    for (let i = 0; i < 9; i += 1) rows.push({ contextKey: 'X', value: 10, dimensions: { chamber: 'A' } });
    rows.push({ contextKey: 'X', value: 999, dimensions: { chamber: 'B' } });
    // ctx Y: 정상 9개(챔버 A) + 이상 3개(챔버 B)
    for (let i = 0; i < 9; i += 1) rows.push({ contextKey: 'Y', value: 20, dimensions: { chamber: 'A' } });
    for (let i = 0; i < 3; i += 1) rows.push({ contextKey: 'Y', value: 999, dimensions: { chamber: 'B' } });

    const marked = markAnomalies(rows, 3);
    const result = commonality(marked, ['chamber'], 3);

    expect(result.badRows).toBeGreaterThan(0);
    // 최상위 과대표집 차원값은 챔버 B여야 한다
    const top = result.findings[0];
    expect(top.dimension).toBe('chamber');
    expect(top.value).toBe('B');
    expect(top.ratioGap).toBeGreaterThan(0);
  });

  it('minSupport 미만 값은 제외한다', () => {
    const rows: CommonalityRow[] = [
      ...Array.from({ length: 9 }, () => ({ contextKey: 'A', value: 10, dimensions: { lot: 'L1' } })),
      { contextKey: 'A', value: 999, dimensions: { lot: 'L2' } },
    ];
    const marked = markAnomalies(rows, 3);
    const result = commonality(marked, ['lot'], 3);
    // L2는 support=1 < 3 → 제외
    expect(result.findings.find((f) => f.value === 'L2')).toBeUndefined();
  });
});
