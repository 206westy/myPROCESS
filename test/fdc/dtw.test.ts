import { describe, test, expect } from 'vitest';
import { dtw } from '../../lib/fdc/dtw';
import { resample, buildEnvelope, scoreDeviation } from '../../lib/fdc/golden-trace';
import { gaussianGen } from '../../lib/bench/inject';

describe('DTW', () => {
  test('동일 트레이스 거리 0', () => {
    const a = [1, 2, 3, 4, 5];
    expect(dtw(a, a).distance).toBe(0);
  });

  test('시간 신축된 동일 형태는 점대점보다 작은 거리', () => {
    const a = [0, 1, 2, 3, 4];
    const b = [0, 0, 1, 2, 3, 4, 4]; // 같은 형태, 늘어남
    const d = dtw(a, b);
    expect(d.distance).toBeLessThan(5);
    expect(d.path.length).toBeGreaterThan(0);
  });
});

describe('골든 트레이스 엔벨로프', () => {
  test('resample은 목표 길이로 맞춘다', () => {
    expect(resample([0, 10], 5)).toEqual([0, 2.5, 5, 7.5, 10]);
  });

  test('정상 범위 트레이스는 알람 없음, 이탈 트레이스는 알람', () => {
    // 베이스라인 트레이스에 작은 잡음을 둬 엔벨로프 폭(σ>0)을 만든다.
    const g = gaussianGen(7);
    const baseline = Array.from({ length: 10 }, () =>
      Array.from({ length: 20 }, (_, i) => Math.sin(i / 3) + 0.05 * g()),
    );
    const env = buildEnvelope(baseline, 20, 3);
    const normal = Array.from({ length: 20 }, (_, i) => Math.sin(i / 3));
    const faulty = Array.from({ length: 20 }, (_, i) => Math.sin(i / 3) + 5);
    expect(scoreDeviation(normal, env).alarm).toBe(false);
    expect(scoreDeviation(faulty, env).alarm).toBe(true);
  });
});
