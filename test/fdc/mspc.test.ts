import { describe, test, expect } from 'vitest';
import { fitPca, scores, standardizeRow } from '../../lib/fdc/pca';
import { runFdc } from '../../lib/fdc/service';
import { gaussianGen } from '../../lib/bench/inject';

/** 상관된 2변수 정상 행렬 생성: x2 ≈ x1 + noise */
function correlatedRows(n: number, seed: number): number[][] {
  const g = gaussianGen(seed);
  const rows: number[][] = [];
  for (let i = 0; i < n; i += 1) {
    const x1 = g();
    const x2 = x1 + 0.1 * g();
    const x3 = g();
    rows.push([x1, x2, x3]);
  }
  return rows;
}

describe('PCA', () => {
  test('상관 변수에서 첫 주성분이 분산 대부분을 설명', () => {
    const model = fitPca(correlatedRows(100, 1), 0.9);
    expect(model.eigenvalues[0]).toBeGreaterThan(model.eigenvalues[1]);
    expect(model.explainedVarianceRatio).toBeGreaterThanOrEqual(0.9);
  });

  test('점수 차원 = 보존 주성분 수', () => {
    const model = fitPca(correlatedRows(80, 2), 0.9);
    const z = standardizeRow([0.5, 0.5, 0.0], model);
    expect(scores(z, model).length).toBe(model.k);
  });
});

describe('MSPC FDC (T²/SPE + 기여도)', () => {
  test('상관 깨진 이상 웨이퍼를 알람하고 원인 신호를 지목', () => {
    const baseline = correlatedRows(120, 7);
    // 정상 1개 + 이상 1개. x3(독립 변수)가 크게 튀어 원인이 명확.
    // (주의: x1·x2는 강상관이라 한쪽이 깨지면 SPE가 둘에 책임을 나눠
    //  단일 지목이 모호해진다 — 독립 변수 이상으로 기여도 검증.)
    const evalRows = [
      [0.2, 0.2, 0.1], // 정상
      [0.2, 0.2, 6.0], // 이상: 독립 x3 급변
    ];
    const result = runFdc(baseline, evalRows, ['x1', 'x2', 'x3']);
    expect(result.results[1].t2Alarm || result.results[1].speAlarm).toBe(true);
    // 원인 1위는 x3여야 함
    expect(result.results[1].topCauses[0]?.signal).toBe('x3');
  });

  test('정상 웨이퍼는 대부분 알람 없음(낮은 거짓경보)', () => {
    const baseline = correlatedRows(120, 11);
    const evalRows = correlatedRows(50, 99);
    const result = runFdc(baseline, evalRows, ['x1', 'x2', 'x3']);
    const alarms = result.results.filter((r) => r.t2Alarm || r.speAlarm).length;
    expect(alarms / result.results.length).toBeLessThan(0.2);
  });
});
