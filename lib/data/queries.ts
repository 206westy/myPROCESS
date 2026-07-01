/**
 * 데이터 접근 계층(Repository 패턴) — DuckDB 슬라이스/집계 쿼리.
 *
 * 보안: 신호명은 SQL 식별자로 직접 보간되므로(바인드 파라미터 불가)
 * 반드시 SIGNAL_COLUMNS 화이트리스트로 검증한다. 그 외 모든 값은
 * 바인드 파라미터로 전달한다.
 */

import { query } from './duckdb';
import { SIGNAL_COLUMNS, TRACE_TABLE, SIGNAL_STATS_TABLE } from '../csv/columns';
import { INDICATORS_TABLE } from '../indicators/sql';
import { assertIndicator, DEFAULT_INDICATOR } from '../indicators/catalog';
import { QUALITY_TABLE, assertQualityResponse } from '../yield/schema';
import type { SpcContext, WaferPoint } from '../spc/types';
import type {
  ContextRow,
  SignalStat,
  WaferStepRow,
  TraceSeries,
} from '../api/types';

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

/** 지표 materialized 테이블 존재 여부(없으면 지표 기능 우아하게 비활성) */
export async function hasIndicatorTable(): Promise<boolean> {
  const rows = await query<{ n: bigint | number }>(
    `SELECT count(*) AS n FROM information_schema.tables WHERE table_name = ?`,
    [INDICATORS_TABLE],
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

/**
 * 한 컨텍스트(Recipe×Stage×Step) 안에서 웨이퍼 런별 **선택 지표값**을
 * 관리도 점으로 반환한다(사전계산된 wafer_step_indicators에서 조회).
 * indicator='mean'이면 getWaferPoints와 동일 의미(평균). 지표명은
 * 카탈로그 화이트리스트로 검증 후 식별자로 보간한다(인젝션 방지).
 */
export async function getWaferPointsByIndicator(
  context: SpcContext,
  signal: string,
  indicator: string = DEFAULT_INDICATOR,
): Promise<WaferPoint[]> {
  assertSignal(signal);
  const ind = assertIndicator(indicator); // 화이트리스트 검증
  const rows = await query<{
    lot: string;
    wafer_no: string;
    time: string;
    value: number | null;
    std: number | null;
    min_val: number | null;
    max_val: number | null;
    n_samples: bigint | number;
  }>(
    `
    SELECT lot, wafer_no,
      strftime(start_time, '%Y-%m-%dT%H:%M:%S') AS time,
      ${ind.id} AS value,
      std, min_val, max_val, n_samples
    FROM ${INDICATORS_TABLE}
    WHERE signal = ? AND recipe = ? AND stage = ? AND recipe_step_num = ?
      AND ${ind.id} IS NOT NULL
    ORDER BY start_time
  `,
    [signal, context.recipe, context.stage, context.recipeStepNum],
  );
  return rows
    .filter((r) => r.value !== null && Number.isFinite(Number(r.value)))
    .map((r) => ({
      lot: r.lot,
      waferNo: r.wafer_no,
      time: r.time,
      value: Number(r.value),
      std: Number(r.std ?? 0),
      min: Number(r.min_val ?? r.value),
      max: Number(r.max_val ?? r.value),
      samples: Number(r.n_samples),
    }));
}

/** 수율 테이블 존재 여부(없으면 수율 연결 기능 비활성) */
export async function hasQualityData(): Promise<boolean> {
  const rows = await query<{ n: bigint | number }>(
    `SELECT count(*) AS n FROM information_schema.tables WHERE table_name = ?`,
    [QUALITY_TABLE],
  );
  if (Number(rows[0]?.n ?? 0) === 0) return false;
  const cnt = await query<{ n: bigint | number }>(`SELECT count(*) AS n FROM ${QUALITY_TABLE}`);
  return Number(cnt[0]?.n ?? 0) > 0;
}

/** 지표↔수율 조인 쌍(한 컨텍스트×신호×지표) — Pearson 입력 */
export async function getIndicatorYieldPairs(
  context: SpcContext,
  signal: string,
  indicator: string,
  response: string,
): Promise<{ value: number; response: number }[]> {
  assertSignal(signal);
  const ind = assertIndicator(indicator);
  const resp = assertQualityResponse(response);
  const rows = await query<{ value: number | null; response: number | null }>(
    `
    SELECT i.${ind.id} AS value, q.${resp} AS response
    FROM ${INDICATORS_TABLE} i
    JOIN ${QUALITY_TABLE} q ON i.lot = q.lot AND i.wafer_no = q.wafer_no
    WHERE i.signal = ? AND i.recipe = ? AND i.stage = ? AND i.recipe_step_num = ?
      AND i.${ind.id} IS NOT NULL AND q.${resp} IS NOT NULL
  `,
    [signal, context.recipe, context.stage, context.recipeStepNum],
  );
  return rows
    .filter((r) => r.value !== null && r.response !== null)
    .map((r) => ({ value: Number(r.value), response: Number(r.response) }));
}

/**
 * 한 컨텍스트×지표에서 전체 신호의 지표↔수율 Pearson 상관을 한 번에 산출.
 * DuckDB `corr(y, x)` 집계 사용. |r| 큰 순으로 정렬.
 */
export async function getYieldCorrelations(
  context: SpcContext,
  indicator: string,
  response: string,
  minN = 5,
): Promise<{ signal: string; r: number; n: number }[]> {
  const ind = assertIndicator(indicator);
  const resp = assertQualityResponse(response);
  const rows = await query<{ signal: string; r: number | null; n: bigint | number }>(
    `
    SELECT i.signal AS signal,
      corr(q.${resp}, i.${ind.id}) AS r,
      count(*)::INTEGER AS n
    FROM ${INDICATORS_TABLE} i
    JOIN ${QUALITY_TABLE} q ON i.lot = q.lot AND i.wafer_no = q.wafer_no
    WHERE i.recipe = ? AND i.stage = ? AND i.recipe_step_num = ?
      AND i.${ind.id} IS NOT NULL AND q.${resp} IS NOT NULL
    GROUP BY i.signal
    HAVING count(*) >= ?
    ORDER BY abs(corr(q.${resp}, i.${ind.id})) DESC NULLS LAST
  `,
    [context.recipe, context.stage, context.recipeStepNum, minN],
  );
  return rows
    .filter((r) => r.r !== null && Number.isFinite(Number(r.r)))
    .map((r) => ({ signal: r.signal, r: Number(r.r), n: Number(r.n) }));
}

/** Commonality 분석용 원시 행(웨이퍼-step 단위 지표값 + 차원) */
export interface CommonalityQueryRow {
  lot: string;
  waferNo: string;
  recipe: string;
  stage: string;
  recipeStepNum: number;
  systemLabel: string;
  startTime: string;
  value: number;
}

/**
 * 한 신호×지표의 웨이퍼-step 행을 (선택)recipe 범위로 조회 — Commonality용.
 * 차원(컨텍스트/챔버/시간)은 호출 측에서 조립한다.
 */
export async function getCommonalityRows(
  signal: string,
  indicator: string = DEFAULT_INDICATOR,
  recipe?: string,
): Promise<CommonalityQueryRow[]> {
  assertSignal(signal);
  const ind = assertIndicator(indicator);
  const where = ['signal = ?', `${ind.id} IS NOT NULL`];
  const params: unknown[] = [signal];
  if (recipe) {
    where.push('recipe = ?');
    params.push(recipe);
  }
  const rows = await query<{
    lot: string;
    wafer_no: string;
    recipe: string;
    stage: string;
    recipe_step_num: number;
    system_label: string;
    start_time: string;
    value: number | null;
  }>(
    `
    SELECT lot, wafer_no, recipe, stage, recipe_step_num, system_label,
      strftime(start_time, '%Y-%m-%dT%H:%M:%S') AS start_time,
      ${ind.id} AS value
    FROM ${INDICATORS_TABLE}
    WHERE ${where.join(' AND ')}
    ORDER BY start_time
  `,
    params,
  );
  return rows
    .filter((r) => r.value !== null && Number.isFinite(Number(r.value)))
    .map((r) => ({
      lot: r.lot,
      waferNo: r.wafer_no,
      recipe: r.recipe,
      stage: r.stage,
      recipeStepNum: Number(r.recipe_step_num),
      systemLabel: r.system_label,
      startTime: r.start_time,
      value: Number(r.value),
    }));
}

/**
 * 한 컨텍스트의 웨이퍼별 다신호 집계 행렬 — 다변량 FDC(T²/SPE)용.
 * 각 행 = 웨이퍼 런, 각 열 = 신호 평균. 신호명은 화이트리스트 검증 후 보간.
 * 반환 rows는 signals 순서와 동일한 열 순서를 가진다.
 */
export async function getWaferMatrix(
  context: SpcContext,
  signals: string[],
): Promise<{ lots: { lot: string; waferNo: string; time: string }[]; rows: number[][]; signals: string[] }> {
  const cols = signals.map(assertSignal);
  const avgCols = cols.map((c) => `avg(${c}) AS "${c}"`).join(', ');
  const rows = await query<Record<string, unknown>>(
    `
    SELECT lot, wafer_no,
      strftime(min(processed_time), '%Y-%m-%dT%H:%M:%S') AS t${cols.length ? `, ${avgCols}` : ''}
    FROM ${TRACE_TABLE}
    WHERE recipe = ? AND stage = ? AND recipe_step_num = ?
    GROUP BY lot, wafer_no
    ORDER BY t
  `,
    [context.recipe, context.stage, context.recipeStepNum],
  );
  const lots = rows.map((r) => ({
    lot: String(r.lot),
    waferNo: String(r.wafer_no),
    time: String(r.t),
  }));
  const matrix = rows.map((r) =>
    cols.map((c) => {
      const v = r[c];
      return v === null || v === undefined ? Number.NaN : Number(v);
    }),
  );
  return { lots, rows: matrix, signals: cols };
}

/** 한 컨텍스트의 setpoint 신호 웨이퍼별 평균(규격 유도용) */
export async function getSetpointValues(
  context: SpcContext,
  setpointSignal: string,
): Promise<number[]> {
  const col = assertSignal(setpointSignal);
  const rows = await query<{ value: number | null }>(
    `
    SELECT avg(${col}) AS "value"
    FROM ${TRACE_TABLE}
    WHERE recipe = ? AND stage = ? AND recipe_step_num = ? AND ${col} IS NOT NULL
    GROUP BY lot, wafer_no
    ORDER BY min(processed_time)
  `,
    [context.recipe, context.stage, context.recipeStepNum],
  );
  return rows.map((r) => Number(r.value)).filter((v) => Number.isFinite(v));
}

/** 장비 가동 분석용 웨이퍼 런(시작/끝/누적 RF on-time) */
export interface EquipmentRunRow {
  lot: string;
  waferNo: string;
  recipe: string;
  startMs: number;
  endMs: number;
  sourceOnTime: number;
}

/**
 * 웨이퍼 런별 처리 구간(첫~끝 샘플 시각, epoch ms)과 RF 누적 가동시간.
 * 트레이스로부터 장비 가동/유휴 타임라인을 재구성하는 입력.
 */
export async function getEquipmentRuns(): Promise<EquipmentRunRow[]> {
  const rows = await query<{
    lot: string;
    wafer_no: string;
    recipe: string;
    start_ms: number;
    end_ms: number;
    source_on_time: number | null;
  }>(`
    SELECT lot, wafer_no, any_value(recipe) AS recipe,
      epoch_ms(min(processed_time)) AS start_ms,
      epoch_ms(max(processed_time)) AS end_ms,
      max(SOURCE_ON_TIME) AS source_on_time
    FROM ${TRACE_TABLE}
    GROUP BY lot, wafer_no
    ORDER BY start_ms
  `);
  return rows.map((r) => ({
    lot: r.lot,
    waferNo: r.wafer_no,
    recipe: r.recipe,
    startMs: Number(r.start_ms),
    endMs: Number(r.end_ms),
    sourceOnTime: r.source_on_time === null ? 0 : Number(r.source_on_time),
  }));
}

/** FDC 선택기용 (Lot×Wafer×Recipe×Stage×Step) 목록 — 시간순 */
export async function listWaferSteps(): Promise<WaferStepRow[]> {
  const rows = await query<{
    lot: string;
    wafer_no: string;
    recipe: string;
    stage: string;
    recipe_step_num: number;
    samples: bigint | number;
    start_time: string;
  }>(`
    SELECT lot, wafer_no, recipe, stage, recipe_step_num,
      count(*)::INTEGER AS samples,
      strftime(min(processed_time), '%Y-%m-%dT%H:%M:%S') AS start_time
    FROM ${TRACE_TABLE}
    GROUP BY lot, wafer_no, recipe, stage, recipe_step_num
    ORDER BY start_time
  `);
  return rows.map((r) => ({
    lot: r.lot,
    waferNo: r.wafer_no,
    recipe: r.recipe,
    stage: r.stage,
    recipeStepNum: Number(r.recipe_step_num),
    samples: Number(r.samples),
    startTime: r.start_time,
  }));
}

/**
 * 한 (Lot×Wafer×Step)의 고주파 트레이스를 선택 신호들에 대해 반환.
 * 신호명은 화이트리스트 검증 후에만 SQL에 보간한다.
 */
export async function getTrace(
  lot: string,
  waferNo: string,
  recipeStepNum: number,
  signals: string[],
): Promise<TraceSeries> {
  const cols = signals.map(assertSignal);
  const selectCols = cols.map((c) => `${c}`).join(', ');
  const rows = await query<Record<string, unknown>>(
    `
    SELECT strftime(processed_time, '%Y-%m-%dT%H:%M:%S.%g') AS t${cols.length ? `, ${selectCols}` : ''}
    FROM ${TRACE_TABLE}
    WHERE lot = ? AND wafer_no = ? AND recipe_step_num = ?
    ORDER BY processed_time
  `,
    [lot, waferNo, recipeStepNum],
  );

  const time = rows.map((r) => String(r.t));
  const series: Record<string, (number | null)[]> = {};
  for (const c of cols) {
    series[c] = rows.map((r) => {
      const v = r[c];
      return v === null || v === undefined ? null : Number(v);
    });
  }
  return { time, signals: series, samples: rows.length };
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
