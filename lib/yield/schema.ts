/**
 * 수율/품질 데이터 브리지 — 테이블 계약(plug-in).
 *
 * 현재 데이터셋은 설비 트레이스뿐이라 수율(WAT/CP/defect/bin)이 없다.
 * 이 모듈은 "수율 데이터가 들어오면 바로 조인되도록" 조인 키와 테이블
 * 스키마를 1급으로 정의해 둔다. data/quality.csv 를 넣고
 * `pnpm load:quality` 를 돌리면 wafer_quality 테이블이 생성된다.
 *
 * 조인 키: (lot, wafer_no) — 지표 테이블 wafer_step_indicators 와 동일.
 */

/** 품질 테이블명 */
export const QUALITY_TABLE = 'wafer_quality';

/** CSV → DB 컬럼 매핑(허용 헤더는 소문자 비교) */
export interface QualityColumn {
  /** DB 컬럼명 */
  db: string;
  /** 허용 CSV 헤더 후보(소문자) */
  aliases: string[];
  type: 'VARCHAR' | 'DOUBLE';
  required: boolean;
}

export const QUALITY_COLUMNS: readonly QualityColumn[] = [
  { db: 'lot', aliases: ['lot', 'lot_id', 'lotid'], type: 'VARCHAR', required: true },
  { db: 'wafer_no', aliases: ['wafer_no', 'wafer', 'waferno', 'wafer_id', 'slot'], type: 'VARCHAR', required: true },
  { db: 'yield_pct', aliases: ['yield_pct', 'yield', 'yield_percent', 'cp_yield'], type: 'DOUBLE', required: false },
  { db: 'defect_count', aliases: ['defect_count', 'defects', 'defect', 'defect_cnt'], type: 'DOUBLE', required: false },
  { db: 'bin', aliases: ['bin', 'hardbin', 'softbin', 'bin_code'], type: 'VARCHAR', required: false },
] as const;

/** 상관 분석 가능한 수치 품질 응답 컬럼 */
export const QUALITY_RESPONSES = [
  { db: 'yield_pct', label: '수율(%)' },
  { db: 'defect_count', label: '결함 수' },
] as const;

export type QualityResponse = (typeof QUALITY_RESPONSES)[number]['db'];

const RESPONSE_SET = new Set<string>(QUALITY_RESPONSES.map((r) => r.db));

/** 응답 컬럼 화이트리스트 검증(인젝션 방지) */
export function assertQualityResponse(col: string): QualityResponse {
  if (!RESPONSE_SET.has(col)) throw new Error(`알 수 없는 수율 응답 컬럼: ${col}`);
  return col as QualityResponse;
}
