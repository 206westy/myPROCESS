/**
 * 장비관리 서비스 — DuckDB 조회 + 순수 상태 재구성 조립.
 */

import { getEquipmentRuns } from '../data/queries';
import {
  computeEquipmentStats,
  computePmProxy,
  type EquipmentStats,
  type PmProxy,
} from './states';

/** RF 누적 가동시간 PM 임계 기본값(단위: SOURCE_ON_TIME 원단위) */
export const DEFAULT_PM_THRESHOLD = 100_000;

export interface EquipmentReport {
  stats: EquipmentStats;
  pm: PmProxy;
  /** 최근 런(타임라인 표시용, 최대 60) */
  recentRuns: {
    lot: string;
    waferNo: string;
    recipe: string;
    start: string;
    durationMs: number;
  }[];
  /** RF on-time 진행(시간순, 최대 200 다운샘플) */
  onTimeTrend: { t: string; value: number }[];
  /** 잠재 다운타임(임계 초과 유휴) 상위 */
  downtimes: { start: string; durationMs: number }[];
}

function iso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}

/** 다운샘플(균등 추출) */
function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = arr.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i += 1) out.push(arr[Math.floor(i * step)]);
  return out;
}

export async function buildEquipmentReport(
  pmThreshold = DEFAULT_PM_THRESHOLD,
): Promise<EquipmentReport> {
  const runs = await getEquipmentRuns();
  const stats = computeEquipmentStats(runs.map((r) => ({ startMs: r.startMs, endMs: r.endMs })));

  const currentOnTime = runs.reduce((mx, r) => Math.max(mx, r.sourceOnTime), 0);
  const pm = computePmProxy(currentOnTime, pmThreshold);

  const recentRuns = [...runs]
    .reverse()
    .slice(0, 60)
    .map((r) => ({
      lot: r.lot,
      waferNo: r.waferNo,
      recipe: r.recipe,
      start: iso(r.startMs),
      durationMs: Math.max(0, r.endMs - r.startMs),
    }));

  const onTimeTrend = downsample(
    runs.filter((r) => r.sourceOnTime > 0),
    200,
  ).map((r) => ({ t: iso(r.startMs), value: r.sourceOnTime }));

  const downtimes = stats.gaps
    .filter((g) => g.isDowntime)
    .sort((a, b) => b.gapMs - a.gapMs)
    .slice(0, 10)
    .map((g) => ({ start: iso(g.startMs), durationMs: g.gapMs }));

  return { stats, pm, recentRuns, onTimeTrend, downtimes };
}
