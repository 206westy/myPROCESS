/**
 * CSV 인제스트 — 32개 SupraXP 트레이스 파트를 DuckDB로 1회 적재한다.
 *
 *   pnpm ingest
 *
 * - read_csv(all_varchar=true)로 따옴표/임베디드 콤마를 안전하게 파싱.
 * - 컨텍스트 7컬럼은 snake_case로 캐스팅, 신호 119컬럼은 TRY_CAST DOUBLE.
 * - signal_stats 테이블에 신호별 통계(타입 추론용)를 산출.
 * - 마지막에 행수/웨이퍼 런 수를 검증 출력한다.
 */

import path from 'node:path';
import fs from 'node:fs';
import { DuckDBInstance } from '@duckdb/node-api';
import {
  CONTEXT_COLUMNS,
  SIGNAL_COLUMNS,
  RECIPE_MAX_STEP_CSV,
  TRACE_TABLE,
  SIGNAL_STATS_TABLE,
} from '../lib/csv/columns.js';

const DATA_GLOB = 'supraxp_ehm target data/RawData_*.csv';
const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'ehm.duckdb');
const EXPECTED_ROWS = 107165;

/** 컨텍스트 컬럼 SELECT 식 생성 */
function contextSelect(): string {
  return CONTEXT_COLUMNS.map((c) => {
    if (c.type === 'TIMESTAMP') {
      // ISO8601 파싱 — 밀리초 유무 두 포맷을 폴백 처리(일부 샘플은 .%f 없음)
      return `coalesce(
        try_strptime("${c.csv}", '%Y-%m-%dT%H:%M:%S.%fZ'),
        try_strptime("${c.csv}", '%Y-%m-%dT%H:%M:%SZ')
      )::TIMESTAMP AS ${c.db}`;
    }
    if (c.type === 'INTEGER') {
      return `TRY_CAST("${c.csv}" AS INTEGER) AS ${c.db}`;
    }
    return `"${c.csv}" AS ${c.db}`;
  }).join(',\n  ');
}

/** 신호 컬럼 SELECT 식 생성(전부 DOUBLE) */
function signalSelect(): string {
  return SIGNAL_COLUMNS.map((s) => `TRY_CAST("${s}" AS DOUBLE) AS ${s}`).join(',\n  ');
}

/** 신호별 통계 산출 SQL(UNION ALL) */
function signalStatsSelect(): string {
  return SIGNAL_COLUMNS.map(
    (s) => `SELECT '${s}' AS signal,
      count(${s}) AS non_null,
      min(${s}) AS min_val,
      max(${s}) AS max_val,
      approx_count_distinct(${s}) AS distinct_vals,
      (min(${s}) >= 0 AND max(${s}) <= 1 AND approx_count_distinct(${s}) <= 2) AS is_flag
    FROM ${TRACE_TABLE}`,
  ).join('\n    UNION ALL\n    ');
}

async function main() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  if (fs.existsSync(DB_PATH)) {
    fs.rmSync(DB_PATH, { force: true });
    fs.rmSync(`${DB_PATH}.wal`, { force: true });
  }

  console.log(`[ingest] DuckDB 생성: ${DB_PATH}`);
  const instance = await DuckDBInstance.create(DB_PATH);
  const conn = await instance.connect();

  console.log('[ingest] trace 테이블 적재 중...');
  await conn.run(`
    CREATE TABLE ${TRACE_TABLE} AS
    SELECT
      ${contextSelect()},
      TRY_CAST("${RECIPE_MAX_STEP_CSV}" AS INTEGER) AS recipe_max_step,
      ${signalSelect()}
    FROM read_csv('${DATA_GLOB}', header = true, all_varchar = true);
  `);

  console.log('[ingest] 컨텍스트 인덱스 생성...');
  await conn.run(
    `CREATE INDEX idx_ctx ON ${TRACE_TABLE} (recipe, stage, recipe_step_num);`,
  );
  await conn.run(
    `CREATE INDEX idx_wafer ON ${TRACE_TABLE} (lot, wafer_no, recipe_step_num);`,
  );

  console.log('[ingest] signal_stats 산출...');
  await conn.run(`
    CREATE TABLE ${SIGNAL_STATS_TABLE} AS
    ${signalStatsSelect()};
  `);

  // ---- 검증 ----
  const rowsReader = await conn.runAndReadAll(
    `SELECT count(*) AS n FROM ${TRACE_TABLE}`,
  );
  const rowCount = Number(rowsReader.getRowObjects()[0].n);

  const ctxReader = await conn.runAndReadAll(`
    SELECT
      count(DISTINCT lot) AS lots,
      count(DISTINCT recipe) AS recipes,
      count(DISTINCT stage) AS stages,
      count(DISTINCT recipe_step_num) AS steps,
      count(DISTINCT (lot, wafer_no)) AS wafer_runs
    FROM ${TRACE_TABLE}
  `);
  const ctx = ctxReader.getRowObjects()[0];

  const nullTsReader = await conn.runAndReadAll(
    `SELECT count(*) AS n FROM ${TRACE_TABLE} WHERE processed_time IS NULL`,
  );
  const nullTs = Number(nullTsReader.getRowObjects()[0].n);

  console.log('\n===== 인제스트 검증 =====');
  console.log(`행수            : ${rowCount.toLocaleString()} (기대 ${EXPECTED_ROWS.toLocaleString()})`);
  console.log(`Lot / Recipe    : ${ctx.lots} / ${ctx.recipes}`);
  console.log(`Stage / Step    : ${ctx.stages} / ${ctx.steps}`);
  console.log(`웨이퍼 런        : ${ctx.wafer_runs} (기대 292)`);
  console.log(`타임스탬프 NULL : ${nullTs}`);

  if (rowCount !== EXPECTED_ROWS) {
    throw new Error(`행수 불일치: ${rowCount} != ${EXPECTED_ROWS}`);
  }
  if (nullTs > 0) {
    throw new Error(`타임스탬프 파싱 실패 ${nullTs}건`);
  }
  console.log('\n[ingest] 완료 ✓');

  conn.closeSync();
}

main().catch((err) => {
  console.error('[ingest] 실패:', err);
  process.exit(1);
});
