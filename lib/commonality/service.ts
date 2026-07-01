/**
 * Commonality 서비스 — DuckDB 조회 + 순수 분석 조립.
 */

import { getCommonalityRows } from '../data/queries';
import {
  markAnomalies,
  commonality,
  type CommonalityRow,
  type CommonalityResult,
} from './analyze';

/** 분석에 사용하는 차원 목록(과대표집 후보) */
export const COMMONALITY_DIMENSIONS = [
  'recipe',
  'stage',
  'step',
  'chamber',
  'lot',
  'date',
] as const;

export interface CommonalityReport extends CommonalityResult {
  signal: string;
  indicator: string;
  k: number;
  /** 이상 웨이퍼-step 목록(상위 표시용) */
  anomalies: {
    lot: string;
    waferNo: string;
    recipe: string;
    stage: string;
    step: number;
    chamber: string;
    time: string;
    value: number;
    robustZ: number;
  }[];
}

/**
 * 신호×지표의 컨텍스트 내 이상치를 표시하고 차원별 commonality를 산출.
 * @param k 로버스트 z 임계(기본 3.5)
 */
export async function buildCommonalityReport(
  signal: string,
  indicator: string,
  opts: { recipe?: string; k?: number } = {},
): Promise<CommonalityReport> {
  const k = opts.k ?? 3.5;
  const raw = await getCommonalityRows(signal, indicator, opts.recipe);

  const rows: CommonalityRow[] = raw.map((r) => ({
    contextKey: `${r.recipe}|${r.stage}|${r.recipeStepNum}`,
    value: r.value,
    dimensions: {
      recipe: r.recipe,
      stage: r.stage,
      step: String(r.recipeStepNum),
      chamber: r.systemLabel,
      lot: r.lot,
      date: r.startTime.slice(0, 10),
    },
  }));

  const marked = markAnomalies(rows, k);
  const result = commonality(marked, COMMONALITY_DIMENSIONS, 3);

  const anomalies = marked
    .map((m, i) => ({ m, raw: raw[i] }))
    .filter(({ m }) => m.isBad)
    .sort((a, b) => Math.abs(b.m.robustZ) - Math.abs(a.m.robustZ))
    .slice(0, 50)
    .map(({ m, raw: r }) => ({
      lot: r.lot,
      waferNo: r.waferNo,
      recipe: r.recipe,
      stage: r.stage,
      step: r.recipeStepNum,
      chamber: r.systemLabel,
      time: r.startTime,
      value: r.value,
      robustZ: m.robustZ,
    }));

  return { ...result, signal, indicator, k, anomalies };
}
