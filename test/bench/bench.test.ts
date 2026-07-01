import { describe, test, expect } from 'vitest';
import { injectFault, normalSeries } from '../../lib/bench/inject';
import { detectionMetrics } from '../../lib/bench/metrics';
import { runScenario } from '../../lib/bench/harness';

describe('합성 결함 주입', () => {
  test('shift는 시작 이후 모든 점을 결함으로 라벨', () => {
    const base = normalSeries(20, 0, 1, 1);
    const inj = injectFault(base, { type: 'shift', start: 10, magnitude: 2 }, 1);
    expect(inj.faultyIndices.has(10)).toBe(true);
    expect(inj.faultyIndices.has(19)).toBe(true);
    expect(inj.faultyIndices.has(9)).toBe(false);
    // 결함 구간 값이 실제로 +2 이동
    expect(inj.values[10]).toBeCloseTo(base[10] + 2);
  });

  test('결정적: 같은 시드는 같은 시계열', () => {
    expect(normalSeries(10, 0, 1, 42)).toEqual(normalSeries(10, 0, 1, 42));
  });

  test('spike는 한 점만 결함', () => {
    const base = normalSeries(20, 0, 1, 3);
    const inj = injectFault(base, { type: 'spike', start: 10, magnitude: 4 }, 1);
    expect(inj.faultyIndices.size).toBe(1);
  });
});

describe('탐지 지표', () => {
  test('완벽 탐지 시 P=R=1, 지연 0', () => {
    const faulty = new Set([5, 6, 7]);
    const alarms = new Set([5, 6, 7]);
    const m = detectionMetrics(faulty, alarms, 10, 5);
    expect(m.precision).toBe(1);
    expect(m.recall).toBe(1);
    expect(m.detectionDelay).toBe(0);
    expect(m.falseAlarmRate).toBe(0);
  });

  test('정상 점 알람은 FAR에 반영', () => {
    const faulty = new Set<number>([8, 9]);
    const alarms = new Set([2, 8]); // 2는 거짓경보
    const m = detectionMetrics(faulty, alarms, 10, 8);
    expect(m.falsePositives).toBe(1);
    expect(m.falseAlarmRate).toBeCloseTo(1 / 8);
  });
});

describe('벤치마크 하니스', () => {
  test('EWMA/CUSUM은 작은 시프트에서 정적 3σ보다 재현율이 높다', () => {
    const report = runScenario({ type: 'shift', start: 60, magnitude: 1 }, { n: 120, baselineN: 30 });
    const get = (m: string) => report.results.find((r) => r.method === m)!;
    expect(get('cusum').metrics.recall).toBeGreaterThan(get('static3sigma').metrics.recall);
  });

  test('정적 3σ는 큰 시프트에서 거짓경보율이 동결 I-MR보다 높다', () => {
    const report = runScenario({ type: 'shift', start: 60, magnitude: 3 }, { n: 120, baselineN: 30 });
    const get = (m: string) => report.results.find((r) => r.method === m)!;
    expect(get('static3sigma').metrics.falseAlarmRate).toBeGreaterThan(
      get('frozenImr').metrics.falseAlarmRate,
    );
  });
});
