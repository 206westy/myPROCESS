/**
 * 수율/품질 CSV 로더(선택) — data/quality.csv → wafer_quality 테이블.
 *
 *   pnpm load:quality
 *
 * CSV가 없으면 안내만 하고 종료(에러 아님). 헤더는 schema.ts의 alias로
 * 유연 매핑한다. 조인 키 (lot, wafer_no)는 필수.
 */

import path from 'node:path';
import fs from 'node:fs';
import { DuckDBInstance } from '@duckdb/node-api';
import { QUALITY_TABLE, QUALITY_COLUMNS } from '../lib/yield/schema.js';

const DB_PATH = path.join(process.cwd(), 'data', 'ehm.duckdb');
const CSV_PATH = path.join(process.cwd(), 'data', 'quality.csv');

/** CSV 첫 줄에서 헤더 추출(따옴표/공백 정리) */
function readHeader(file: string): string[] {
  const firstLine = fs.readFileSync(file, 'utf8').split(/\r?\n/)[0] ?? '';
  return firstLine.split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
}

/** db 컬럼 → 실제 CSV 헤더명(없으면 null) */
function resolveMapping(headers: string[]): Map<string, string | null> {
  const lower = new Map(headers.map((h) => [h.toLowerCase(), h]));
  const map = new Map<string, string | null>();
  for (const col of QUALITY_COLUMNS) {
    const hit = col.aliases.map((a) => lower.get(a)).find(Boolean) ?? null;
    if (col.required && !hit) {
      throw new Error(`필수 컬럼 '${col.db}' 누락 — 허용 헤더: ${col.aliases.join(', ')}`);
    }
    map.set(col.db, hit);
  }
  return map;
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.log(`[quality] ${CSV_PATH} 없음 — 수율 데이터 미적재(수율 연결 기능 비활성).`);
    console.log('[quality] CSV(헤더: lot, wafer_no, yield_pct[, defect_count, bin]) 추가 후 재실행하세요.');
    return;
  }
  if (!fs.existsSync(DB_PATH)) throw new Error(`DB 없음: ${DB_PATH} — 먼저 pnpm ingest`);

  const headers = readHeader(CSV_PATH);
  const mapping = resolveMapping(headers);

  const selectExprs = QUALITY_COLUMNS.map((col) => {
    const src = mapping.get(col.db);
    if (!src) return `CAST(NULL AS ${col.type}) AS ${col.db}`;
    return col.type === 'DOUBLE'
      ? `TRY_CAST("${src}" AS DOUBLE) AS ${col.db}`
      : `"${src}" AS ${col.db}`;
  }).join(',\n      ');

  console.log(`[quality] DB 열기(쓰기): ${DB_PATH}`);
  const instance = await DuckDBInstance.create(DB_PATH);
  const conn = await instance.connect();

  await conn.run(`DROP TABLE IF EXISTS ${QUALITY_TABLE};`);
  await conn.run(`
    CREATE TABLE ${QUALITY_TABLE} AS
    SELECT
      ${selectExprs}
    FROM read_csv('${CSV_PATH.replace(/\\/g, '/')}', header = true, all_varchar = true);
  `);
  await conn.run(`CREATE INDEX idx_quality_key ON ${QUALITY_TABLE} (lot, wafer_no);`);

  const reader = await conn.runAndReadAll(`SELECT count(*) AS n FROM ${QUALITY_TABLE}`);
  console.log(`[quality] 적재 완료 ✓ ${Number(reader.getRowObjects()[0].n)} 행`);
  conn.closeSync();
}

main().catch((err) => {
  console.error('[quality] 실패:', err);
  process.exit(1);
});
