/**
 * API DTO 타입(서버/클라이언트 공용). 여기에는 런타임 코드가 없어
 * 클라이언트 번들에 서버 의존성(DuckDB)이 끌려가지 않는다.
 */

export interface ContextRow {
  recipe: string;
  stage: string;
  recipeStepNum: number;
  waferRuns: number;
  samples: number;
}

export interface SignalStat {
  signal: string;
  nonNull: number;
  minVal: number | null;
  maxVal: number | null;
  distinctVals: number;
  isFlag: boolean;
}

export interface ContextMeta {
  contexts: ContextRow[];
  signals: SignalStat[];
}

export interface WaferStepRow {
  lot: string;
  waferNo: string;
  recipe: string;
  stage: string;
  recipeStepNum: number;
  samples: number;
  startTime: string;
}

export interface TraceSeries {
  time: string[];
  signals: Record<string, (number | null)[]>;
  samples: number;
}

export interface DimensionFindingDto {
  dimension: string;
  value: string;
  badCount: number;
  goodCount: number;
  badRatio: number;
  goodRatio: number;
  ratioGap: number;
  z: number;
  significant: boolean;
  support: number;
}

export interface AnomalyRowDto {
  lot: string;
  waferNo: string;
  recipe: string;
  stage: string;
  step: number;
  chamber: string;
  time: string;
  value: number;
  robustZ: number;
}

export interface CommonalityReportDto {
  signal: string;
  indicator: string;
  k: number;
  totalRows: number;
  badRows: number;
  goodRows: number;
  findings: DimensionFindingDto[];
  anomalies: AnomalyRowDto[];
}
