/**
 * 지표 테이블 빌드(마이그레이션) — 기존 trace 테이블로부터 `wafer_step_indicators`를
 * 산출한다. 원본 CSV 재인제스트 없이 현재 DB에 지표를 추가할 때 사용.
 *
 *   pnpm build:indicators
 *
 * 인제스트(`scripts/ingest.ts`)도 동일 SQL을 호출하므로, 새로 인제스트하면
 * 자동 포함된다. 이 스크립트는 이미 만들어진 DB를 갱신하는 용도.
 */

import path from 'node:path';
import fs from 'node:fs';
import { DuckDBInstance } from '@duckdb/node-api';
import {
  INDICATORS_TABLE,
  buildIndicatorsTableSql,
  buildIndicatorIndexSql,
} from '../lib/indicators/sql.js';

const DB_PATH = path.join(process.cwd(), 'data', 'ehm.duckdb');

async function main() {
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`DB 없음: ${DB_PATH} — 먼저 'pnpm ingest' 실행`);
  }

  console.log(`[indicators] DB 열기(쓰기): ${DB_PATH}`);
  const instance = await DuckDBInstance.create(DB_PATH);
  const conn = await instance.connect();

  console.log(`[indicators] 기존 ${INDICATORS_TABLE} 제거(있으면)...`);
  await conn.run(`DROP TABLE IF EXISTS ${INDICATORS_TABLE};`);

  console.log('[indicators] 지표 산출 중(신호×지표 단일패스 집계)...');
  await conn.run(buildIndicatorsTableSql());

  console.log('[indicators] 인덱스 생성...');
  for (const ddl of buildIndicatorIndexSql()) {
    await conn.run(ddl);
  }

  const reader = await conn.runAndReadAll(`
    SELECT count(*) AS rows,
      count(DISTINCT signal) AS signals,
      count(DISTINCT (lot, wafer_no, recipe, stage, recipe_step_num)) AS wafer_steps
    FROM ${INDICATORS_TABLE}
  `);
  const r = reader.getRowObjects()[0];

  console.log('\n===== 지표 테이블 검증 =====');
  console.log(`행수        : ${Number(r.rows).toLocaleString()}`);
  console.log(`신호 수      : ${r.signals}`);
  console.log(`웨이퍼×step  : ${r.wafer_steps}`);
  if (Number(r.rows) === 0) throw new Error('지표 행 0 — trace 비어있음?');
  console.log('\n[indicators] 완료 ✓');

  conn.closeSync();
}

main().catch((err) => {
  console.error('[indicators] 실패:', err);
  process.exit(1);
});
