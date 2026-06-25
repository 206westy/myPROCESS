/**
 * DuckDB 연결 계층 — 읽기 전용 싱글톤.
 *
 * 인제스트로 생성된 `data/ehm.duckdb`를 열어 재사용한다. Next.js 개발
 * 모드의 HMR로 모듈이 재평가돼도 인스턴스가 중복 생성되지 않도록
 * globalThis에 캐시한다.
 */

import path from 'node:path';
import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';

export const DB_PATH = path.join(process.cwd(), 'data', 'ehm.duckdb');

interface DuckDBCache {
  connection: Promise<DuckDBConnection> | null;
}

const globalCache = globalThis as unknown as { __ehmDuckDB?: DuckDBCache };
const cache: DuckDBCache = (globalCache.__ehmDuckDB ??= { connection: null });

async function openConnection(): Promise<DuckDBConnection> {
  const instance = await DuckDBInstance.create(DB_PATH, {
    access_mode: 'READ_ONLY',
  });
  return instance.connect();
}

/** 공유 읽기 전용 커넥션 반환 */
export function getConnection(): Promise<DuckDBConnection> {
  cache.connection ??= openConnection();
  return cache.connection;
}

/** 파라미터 바인딩 쿼리 실행 후 객체 행 배열 반환 */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const connection = await getConnection();
  const prepared = await connection.prepare(sql);
  params.forEach((value, i) => bindParam(prepared, i + 1, value));
  const reader = await prepared.runAndReadAll();
  return reader.getRowObjectsJS() as T[];
}

function bindParam(
  prepared: Awaited<ReturnType<DuckDBConnection['prepare']>>,
  index: number,
  value: unknown,
): void {
  if (value === null || value === undefined) {
    prepared.bindNull(index);
  } else if (typeof value === 'number') {
    prepared.bindDouble(index, value);
  } else if (typeof value === 'boolean') {
    prepared.bindBoolean(index, value);
  } else {
    prepared.bindVarchar(index, String(value));
  }
}
