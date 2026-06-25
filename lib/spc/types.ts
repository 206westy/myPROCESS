/**
 * SPC 도메인 타입.
 *
 * 핵심 개념: 관리도의 1 데이터포인트 = "특정 컨텍스트(Recipe×Stage×Step)
 * 안에서 한 웨이퍼 런 동안 집계된 신호 통계량". 관리한계는 전역 상수가
 * 아니라 **그 컨텍스트에 속한 웨이퍼 포인트들로부터 동적으로 산출**된다.
 */

/** SPC 슬라이싱 컨텍스트 — 관리한계 산출의 그룹 키 */
export interface SpcContext {
  recipe: string;
  stage: string;
  recipeStepNum: number;
}

/** 웨이퍼 런 1건의 집계 통계량(관리도의 한 점) */
export interface WaferPoint {
  lot: string;
  waferNo: string;
  /** 정렬/표시용 대표 시각(해당 스텝 첫 샘플) */
  time: string;
  /** 집계값(기본: 해당 스텝 구간 신호 평균) */
  value: number;
  /** 부가 통계 */
  std: number;
  min: number;
  max: number;
  /** 구간 샘플 수 */
  samples: number;
}

/** 산출된 관리한계 묶음 */
export interface ControlLimits {
  /** 중심선(점 평균) */
  centerLine: number;
  /** 시그마 추정치(이동범위 기반, MR_bar / 1.128) */
  sigma: number;
  ucl: number;
  lcl: number;
  /** 1σ/2σ 존 경계(Western Electric 룰용) */
  zoneUpper1: number;
  zoneUpper2: number;
  zoneLower1: number;
  zoneLower2: number;
  /** 한계 산출에 쓰인 점 개수 */
  n: number;
  /** 표본 부족으로 한계가 통계적으로 불안정한지 */
  insufficient: boolean;
}

/** 관리도 위반 1건 */
export interface Violation {
  /** 위반 점 인덱스(0-base) */
  index: number;
  /** 위반 룰 식별자 */
  rule: SpcRuleId;
  /** 사람이 읽는 설명 */
  message: string;
  /** 심각도 */
  severity: 'alarm' | 'warn';
}

export type SpcRuleId =
  | 'beyond_3sigma'
  | 'two_of_three_2sigma'
  | 'four_of_five_1sigma'
  | 'eight_in_row_side';

/** 관리도 전체 산출 결과 */
export interface ControlChartResult {
  context: SpcContext;
  signal: string;
  points: WaferPoint[];
  limits: ControlLimits;
  violations: Violation[];
}
