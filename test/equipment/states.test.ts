/**
 * 장비 상태 재구성 순수 테스트 — 가동률/유휴/PM 프록시.
 */

import { describe, it, expect } from 'vitest';
import {
  computeEquipmentStats,
  computePmProxy,
  formatDuration,
} from '../../lib/equipment/states';

const MIN = 60_000;
const HOUR = 3_600_000;

describe('computeEquipmentStats', () => {
  it('빈 입력은 0 통계', () => {
    const s = computeEquipmentStats([]);
    expect(s.runs).toBe(0);
    expect(s.utilization).toBe(0);
  });

  it('가동률 = 가동시간 / 전체 구간', () => {
    // 0~10분 가동, 20~30분 가동 → span 30분, productive 20분 → 2/3
    const s = computeEquipmentStats([
      { startMs: 0, endMs: 10 * MIN },
      { startMs: 20 * MIN, endMs: 30 * MIN },
    ]);
    expect(s.productiveMs).toBe(20 * MIN);
    expect(s.spanMs).toBe(30 * MIN);
    expect(s.utilization).toBeCloseTo(2 / 3, 5);
    expect(s.idleMs).toBe(10 * MIN);
  });

  it('임계 초과 유휴를 다운타임으로 분류', () => {
    const s = computeEquipmentStats(
      [
        { startMs: 0, endMs: MIN },
        { startMs: 6 * HOUR, endMs: 6 * HOUR + MIN }, // 6h 유휴
      ],
      4 * HOUR,
    );
    expect(s.gaps).toHaveLength(1);
    expect(s.gaps[0].isDowntime).toBe(true);
    expect(s.longestGapMs).toBe(6 * HOUR - MIN);
  });

  it('정렬되지 않은 입력도 시간순으로 처리', () => {
    const s = computeEquipmentStats([
      { startMs: 20 * MIN, endMs: 30 * MIN },
      { startMs: 0, endMs: 10 * MIN },
    ]);
    expect(s.spanMs).toBe(30 * MIN);
  });
});

describe('computePmProxy', () => {
  it('임계 도달 시 PM 권고', () => {
    expect(computePmProxy(120, 100).due).toBe(true);
    expect(computePmProxy(50, 100).due).toBe(false);
    expect(computePmProxy(50, 100).ratio).toBeCloseTo(0.5, 5);
  });
});

describe('formatDuration', () => {
  it('d/h/m 포맷', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(90 * MIN)).toBe('1h 30m');
    expect(formatDuration(25 * HOUR)).toBe('1d 1h');
  });
});
