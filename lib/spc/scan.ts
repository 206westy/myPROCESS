/**
 * 공정 위험 스캔 — 대시보드 "어디가 위험한가?"에 답한다.
 *
 * 핵심 아날로그 신호들을 상위 컨텍스트(웨이퍼 런 수 기준)에 걸쳐
 * 컨텍스트 적응형 관리도로 평가하고, 위반(alarm/warn) 수로 순위를 매긴다.
 */

import { listContexts } from '../data/queries';
import { buildControlChart } from './service';

/** 대시보드 스캔 대상 핵심 신호(설비 주요 거동) */
export const KEY_SIGNALS = [
  'APC_Position',
  'APC_Pressure',
  'SourcePwr_Read',
  'Mat_VDC',
] as const;

export interface ScanEntry {
  recipe: string;
  stage: string;
  recipeStepNum: number;
  signal: string;
  waferRuns: number;
  alarms: number;
  warns: number;
  insufficient: boolean;
}

export interface ScanResult {
  entries: ScanEntry[];
  totalAlarms: number;
  totalWarns: number;
  scanned: number;
}

/**
 * 상위 topContexts개 컨텍스트 × KEY_SIGNALS를 스캔. 신호가 없거나
 * 데이터가 부족한 조합은 건너뛴다(throw는 무시하고 계속).
 */
export async function scanRisk(topContexts = 8): Promise<ScanResult> {
  const contexts = (await listContexts())
    .sort((a, b) => b.waferRuns - a.waferRuns)
    .slice(0, topContexts);

  const entries: ScanEntry[] = [];
  let scanned = 0;

  for (const ctx of contexts) {
    for (const signal of KEY_SIGNALS) {
      try {
        const chart = await buildControlChart(
          { recipe: ctx.recipe, stage: ctx.stage, recipeStepNum: ctx.recipeStepNum },
          signal,
        );
        scanned += 1;
        if (chart.points.length === 0) continue;
        const alarms = chart.violations.filter((v) => v.severity === 'alarm').length;
        const warns = chart.violations.filter((v) => v.severity === 'warn').length;
        if (alarms === 0 && warns === 0) continue;
        entries.push({
          recipe: ctx.recipe,
          stage: ctx.stage,
          recipeStepNum: ctx.recipeStepNum,
          signal,
          waferRuns: chart.points.length,
          alarms,
          warns,
          insufficient: chart.limits.insufficient,
        });
      } catch {
        // 신호 없음/조회 실패는 스킵
      }
    }
  }

  entries.sort((a, b) => b.alarms - a.alarms || b.warns - a.warns);

  return {
    entries,
    totalAlarms: entries.reduce((s, e) => s + e.alarms, 0),
    totalWarns: entries.reduce((s, e) => s + e.warns, 0),
    scanned,
  };
}
