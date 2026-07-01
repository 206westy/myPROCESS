/**
 * 벤치마킹 하니스 — 방법×시나리오 비교(순수/결정적).
 *
 * 비교 방법:
 *  - static3sigma : 전체 데이터로 매번 재계산한 3σ(현행 방식의 함정 재현)
 *  - frozenImr    : 베이스라인 동결 I-MR
 *  - ewma         : 베이스라인 기준 EWMA
 *  - cusum        : 베이스라인 기준 CUSUM
 *  - residual     : AR(1) 잔차 I-MR
 *
 * 각 방법을 "값 배열 → 알람 인덱스 집합"으로 통일해, 동일 시나리오에서
 * 탐지 지표(metrics)와 ARL을 산출한다.
 */

import { computeControlLimits } from '../spc/limits';
import { buildEwmaChart } from '../spc/charts/ewma';
import { buildCusumChart } from '../spc/charts/cusum';
import { buildResidualChart } from '../spc/charts/residual';
import type { WaferPoint } from '../spc/types';
import { detectionMetrics, type DetectionMetrics } from './metrics';
import { estimateArl, type FirstAlarmFn } from './arl';
import { injectFault, normalSeries, type FaultSpec } from './inject';

export type MethodId = 'static3sigma' | 'frozenImr' | 'ewma' | 'cusum' | 'residual';

export const METHOD_LABELS: Record<MethodId, string> = {
  static3sigma: '정적 3σ(전체 재계산)',
  frozenImr: '동결 I-MR(베이스라인)',
  ewma: 'EWMA',
  cusum: 'CUSUM',
  residual: 'AR(1) 잔차',
};

function toPoints(values: readonly number[]): WaferPoint[] {
  return values.map((value, i) => ({
    lot: 'bench',
    waferNo: String(i),
    time: '',
    value,
    std: 0,
    min: value,
    max: value,
    samples: 1,
  }));
}

/** 값 배열 → 알람 인덱스 집합 (방법별) */
export function alarmIndices(
  method: MethodId,
  values: readonly number[],
  baselineN: number,
): Set<number> {
  const points = toPoints(values);
  const baseSlice = points.slice(0, Math.min(baselineN, points.length));
  const baseLimits = computeControlLimits(baseSlice);
  const out = new Set<number>();

  if (method === 'static3sigma') {
    const lim = computeControlLimits(points); // 전체로 재계산(오염)
    values.forEach((v, i) => {
      if (lim.sigma > 0 && (v > lim.ucl || v < lim.lcl)) out.add(i);
    });
    return out;
  }
  if (method === 'frozenImr') {
    values.forEach((v, i) => {
      if (baseLimits.sigma > 0 && (v > baseLimits.ucl || v < baseLimits.lcl)) out.add(i);
    });
    return out;
  }
  if (method === 'ewma') {
    buildEwmaChart(points, baseLimits).violations.forEach((vio) => out.add(vio.index));
    return out;
  }
  if (method === 'cusum') {
    buildCusumChart(points, baseLimits).violations.forEach((vio) => out.add(vio.index));
    return out;
  }
  // residual
  buildResidualChart(points).violations.forEach((vio) => out.add(vio.index));
  return out;
}

export interface MethodScenarioResult {
  method: MethodId;
  metrics: DetectionMetrics;
  arl0: number;
  arl1: number;
}

export interface BenchmarkReport {
  scenario: FaultSpec;
  baselineN: number;
  sigma: number;
  results: MethodScenarioResult[];
}

/**
 * 한 시나리오(결함 사양)에 대해 모든 방법을 비교.
 * 정상 베이스 시계열을 만들고 결함을 주입한 뒤 탐지·ARL을 측정.
 */
export function runScenario(
  spec: FaultSpec,
  opts: { n?: number; baselineN?: number; mu?: number; sigma?: number; seed?: number } = {},
): BenchmarkReport {
  const n = opts.n ?? 120;
  const baselineN = opts.baselineN ?? 30;
  const mu = opts.mu ?? 0;
  const sigma = opts.sigma ?? 1;
  const seed = opts.seed ?? 4242;

  const base = normalSeries(n, mu, sigma, seed);
  const injected = injectFault(base, spec, sigma);

  const methods: MethodId[] = ['static3sigma', 'frozenImr', 'ewma', 'cusum', 'residual'];
  const results = methods.map((method) => {
    const alarms = alarmIndices(method, injected.values, baselineN);
    const metrics = detectionMetrics(injected.faultyIndices, alarms, n, spec.start);

    const firstAlarm: FirstAlarmFn = (series) => {
      const idxs = alarmIndices(method, series, baselineN);
      let min = -1;
      for (const i of idxs) if (min < 0 || i < min) min = i;
      return min;
    };
    const arl0 = estimateArl(firstAlarm, 0, { mu, sigma, maxLen: 200, runs: 60, seed }).arl;
    const arl1 = estimateArl(firstAlarm, Math.max(spec.magnitude, 1), {
      mu,
      sigma,
      maxLen: 200,
      runs: 60,
      seed: seed + 1,
    }).arl;

    return { method, metrics, arl0, arl1 };
  });

  return { scenario: spec, baselineN, sigma, results };
}
