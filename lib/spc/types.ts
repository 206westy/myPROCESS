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

// ───────────────────────── 적응형 확장 타입 ─────────────────────────

/** 차트 종류 */
export type ChartType = 'imr' | 'ewma' | 'cusum' | 'residual';

/** 한계 신뢰도 등급 */
export type TrustGrade = 'high' | 'medium' | 'low';

/**
 * 단기(within) vs 전체(total) 변동 분해 + 한계 신뢰도.
 * ratio = σ_total / σ_within. 1에 가까우면 I-MR 한계가 타당,
 * 크면(예: 3↑) 드리프트/이질 모집단으로 한계가 과소(좁게) 추정됨.
 */
export interface TrustScore {
  sigmaWithin: number;
  sigmaTotal: number;
  ratio: number;
  grade: TrustGrade;
  /** 평이한 설명(사용자 표시용) */
  explanation: string;
}

/** 베이스라인(골든) 참조 — 한계를 여기서 1회 산출·동결 */
export interface BaselineRef {
  /** 베이스라인에 쓰인 점 인덱스(원본 시간순) */
  indices: number[];
  /** 베이스라인 점 개수 */
  n: number;
  /** 선정 방식 설명 */
  method: string;
}

/** 고정 규격(엔지니어링/고객 스펙) — 관리한계와 분리 */
export interface SpecLimits {
  target: number | null;
  usl: number | null;
  lsl: number | null;
  /** 규격 출처(setpoint 신호명 또는 'manual') */
  source: string;
}

/** 공정능력 지수 */
export interface Capability {
  cp: number | null;
  cpk: number | null;
  pp: number | null;
  ppk: number | null;
  explanation: string;
}

/** 자기상관/변화점 진단 */
export interface Diagnostics {
  lag1Autocorr: number;
  autocorrSignificant: boolean;
  changePointIndex: number | null;
  /** 정규성 거칠게 판단(왜도 기반) */
  skewness: number;
}

/** 차트 추천 결과 */
export interface ChartRecommendation {
  recommended: ChartType;
  reason: string;
  alternatives: ChartType[];
}

/** 시변 한계를 갖는 차트(점별 통계량 + 점별 한계) */
export interface SeriesChart {
  type: ChartType;
  /** 점별 플롯 통계량(EWMA z, CUSUM C±, 잔차 등) */
  statistic: number[];
  centerLine: number;
  /** 점별 상한(시변 가능) */
  ucl: number[];
  /** 점별 하한 */
  lcl: number[];
  violations: Violation[];
  description: string;
}

/** 적응형 SPC 종합 결과(API 반환) */
export interface AdaptiveSpcResult {
  context: SpcContext;
  signal: string;
  /** 분석 지표 id(기본 'mean'). 지표 엔진으로 선택된 점 통계량 */
  indicator?: string;
  points: WaferPoint[];
  /** 베이스라인 동결 I-MR 한계 */
  limits: ControlLimits;
  baseline: BaselineRef;
  trust: TrustScore;
  diagnostics: Diagnostics;
  recommendation: ChartRecommendation;
  /** 추천 차트의 시변 한계 시리즈 */
  chart: SeriesChart;
  spec: SpecLimits;
  capability: Capability;
  violations: Violation[];
}
