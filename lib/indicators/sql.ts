/**
 * 지표 테이블 빌드 SQL 생성 — `wafer_step_indicators` materialized 테이블.
 *
 * 형식: (웨이퍼×step×신호) 1행 = wide. 컨텍스트 키 + 신호명 + 지표 컬럼들.
 * 각 신호마다 단일 패스 집계 SELECT를 만들어 UNION ALL로 합친다.
 * 신호명은 SIGNAL_COLUMNS 화이트리스트 출신이므로 식별자로 안전하게 보간된다.
 */

import { SIGNAL_COLUMNS, TRACE_TABLE } from '../csv/columns';
import { INDICATORS } from './catalog';

/** 지표 materialized 테이블명 */
export const INDICATORS_TABLE = 'wafer_step_indicators';

/** 컨텍스트/키 컬럼(지표 테이블) — GROUP BY 키와 동일 순서 */
const GROUP_KEYS = [
  'lot',
  'wafer_no',
  'recipe',
  'stage',
  'recipe_step_num',
  'system_label',
] as const;

/** 한 신호에 대한 지표 집계 SELECT 블록 */
function signalBlock(signal: string): string {
  const indicatorCols = INDICATORS.map(
    (ind) => `${ind.sql(signal)} AS ${ind.id}`,
  ).join(',\n      ');
  return `SELECT
      ${GROUP_KEYS.join(', ')},
      min(processed_time) AS start_time,
      '${signal}' AS signal,
      ${indicatorCols}
    FROM ${TRACE_TABLE}
    WHERE ${signal} IS NOT NULL
    GROUP BY ${GROUP_KEYS.join(', ')}
    HAVING count(${signal}) > 0`;
}

/**
 * `wafer_step_indicators` 생성 DDL. 기존 trace 테이블만 있으면 동작하므로
 * 원본 CSV 없이도 재빌드 가능(인제스트/마이그레이션 양쪽에서 재사용).
 */
export function buildIndicatorsTableSql(): string {
  const union = SIGNAL_COLUMNS.map(signalBlock).join('\n    UNION ALL\n    ');
  return `CREATE TABLE ${INDICATORS_TABLE} AS\n    ${union};`;
}

/** 지표 테이블 인덱스 DDL(컨텍스트/웨이퍼 조회 가속) */
export function buildIndicatorIndexSql(): string[] {
  return [
    `CREATE INDEX idx_ind_ctx ON ${INDICATORS_TABLE} (recipe, stage, recipe_step_num, signal);`,
    `CREATE INDEX idx_ind_wafer ON ${INDICATORS_TABLE} (lot, wafer_no, signal);`,
  ];
}
