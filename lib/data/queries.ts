/**
 * 데이터 접근 계층(Repository 패턴) — DuckDB 슬라이스/집계 쿼리.
 *
 * 보안: 신호명은 SQL 식별자로 직접 보간되므로(바인드 파라미터 불가)
 * 반드시 SIGNAL_COLUMNS 화이트리스트로 검증한다. 그 외 모든 값은
 * 바인드 파라미터로 전달한다.
 */

import { query } from './duckdb';
import { SIGNAL_COLUMNS, TRACE_TABLE, SIGNAL_STATS_TABLE } from '../csv/columns';
import type { SpcContext, WaferPoint } from '../spc/types';
import type { ContextRow, SignalStat } from '../api/types';

const SIGNAL_SET = new Set<string>(SIGNAL_COLUMNS);

/** 신호명이 화이트리스트에 있는지 검증(인젝션 방지) */
export function assertSignal(name: string): string {
  if (!SIGNAL_SET.has(name)) {
    throw new Error(`알 수 없는 신호명: ${name}`);
  }
  return name;
}

/** SPC 슬라이싱 컨텍스트 목록(웨이퍼 런 수 포함) */
export async function listContexts(): Promise<ContextRow[]> {
  const rows = await query<{
    recipe: string;
    stage: string;
    recipe_step_num: number;
    wafer_runs: bigint | number;
    samples: bigint | number;
  }>(`
    SELECT recipe, stage, recipe_step_num,
      count(DISTINCT (lot, wafer_no))::INTEGER AS wafer_runs,
      count(*)::INTEGER AS samples
    FROM ${TRACE_TABLE}
    GROUP BY recipe, stage, recipe_step_num
    ORDER BY recipe, stage, recipe_step_num
  `);
  return rows.map((r) => ({
    recipe: r.recipe,
    stage: r.stage,
    recipeStepNum: Number(r.recipe_step_num),
    waferRuns: Number(r.wafer_runs),
    samples: Number(r.samples),
  }));
}

/** 신호 통계 목록(아날로그/플래그 구분 권위) */
export async function listSignalStats(): Promise<SignalStat[]> {
  const rows = await query<{
    signal: string;
    non_null: bigint | number;
    min_val: number | null;
    max_val: number | null;
    distinct_vals: bigint | number;
    is_flag: boolean;
  }>(`SELECT * FROM ${SIGNAL_STATS_TABLE} ORDER BY signal`);
  return rows.map((r) => ({
    signal: r.signal,
    nonNull: Number(r.non_null),
    minVal: r.min_val === null ? null : Number(r.min_val),
    maxVal: r.max_val === null ? null : Number(r.max_val),
    distinctVals: Number(r.distinct_vals),
    isFlag: Boolean(r.is_flag),
  }));
}

/**
 * 한 컨텍스트(Recipe×Stage×Step) 안에서 웨이퍼 런별 신호 집계값을 반환.
 * 각 행이 관리도의 1점이 된다. 시간순 정렬.
 */
export async function getWaferPoints(
  context: SpcContext,
  signal: string,
): Promise<WaferPoint[]> {
  const col = assertSignal(signal);
  const rows = await query<{
    lot: string;
    wafer_no: string;
    time: string;
    value: number | null;
    std: number | null;
    min_val: number | null;
    max_val: number | null;
    samples: bigint | number;
  }>(
    `
    SELECT lot, wafer_no,
      strftime(min(processed_time), '%Y-%m-%dT%H:%M:%S') AS time,
      avg(${col}) AS value,
      coalesce(stddev_samp(${col}), 0) AS std,
      min(${col}) AS min_val,
      max(${col}) AS max_val,
      count(${col})::INTEGER AS samples
    FROM ${TRACE_TABLE}
    WHERE recipe = ? AND stage = ? AND recipe_step_num = ?
      AND ${col} IS NOT NULL
    GROUP BY lot, wafer_no
    HAVING count(${col}) > 0
    ORDER BY time
  `,
    [context.recipe, context.stage, context.recipeStepNum],
  );
  return rows
    .filter((r) => r.value !== null)
    .map((r) => ({
      lot: r.lot,
      waferNo: r.wafer_no,
      time: r.time,
      value: Number(r.value),
      std: Number(r.std ?? 0),
      min: Number(r.min_val ?? r.value),
      max: Number(r.max_val ?? r.value),
      samples: Number(r.samples),
    }));
}

export interface DatasetSummary {
  rows: number;
  lots: number;
  recipes: number;
  stages: number;
  steps: number;
  waferRuns: number;
}

/** 데이터셋 전역 요약(대시보드 KPI) */
export async function getDatasetSummary(): Promise<DatasetSummary> {
  const rows = await query<Record<string, bigint | number>>(`
    SELECT
      count(*)::INTEGER AS rows,
      count(DISTINCT lot)::INTEGER AS lots,
      count(DISTINCT recipe)::INTEGER AS recipes,
      count(DISTINCT stage)::INTEGER AS stages,
      count(DISTINCT recipe_step_num)::INTEGER AS steps,
      count(DISTINCT (lot, wafer_no))::INTEGER AS wafer_runs
    FROM ${TRACE_TABLE}
  `);
  const r = rows[0];
  return {
    rows: Number(r.rows),
    lots: Number(r.lots),
    recipes: Number(r.recipes),
    stages: Number(r.stages),
    steps: Number(r.steps),
    waferRuns: Number(r.wafer_runs),
  };
}
