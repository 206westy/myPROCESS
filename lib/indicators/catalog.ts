/**
 * FDC 지표 카탈로그 — 트레이스 한 구간(웨이퍼×step)에서 신호별로 뽑는
 * 표준 지표(summary indicator)의 단일 출처(DRY).
 *
 * 산업 표준 FDC 파이프라인(Trace → Window → **Indicator** → SPC/MSPC)의
 * 지표 정의부. 현재 SPC가 step 평균 1개만 쓰던 것을 확장해, 모든 지표를
 * 인제스트 시 DuckDB SQL로 사전계산한다(materialized `wafer_step_indicators`).
 *
 * 설계 원칙:
 * - 모든 지표는 GROUP BY (lot, wafer_no, recipe, stage, recipe_step_num) 위에서
 *   **단일 패스 집계식**으로 표현된다(윈도/2-패스 불필요 → SQL 단순·고속).
 * - `sql(col)`은 검증된 식별자 `col`(SIGNAL_COLUMNS 화이트리스트)만 받는다.
 *   시간 기반 지표는 `processed_time` 컬럼을 직접 참조한다.
 */

/** 지표 분류(UI 그룹) */
export type IndicatorKind = 'level' | 'dispersion' | 'shape' | 'reference' | 'meta';

export interface IndicatorDef {
  /** 지표 id = DB 컬럼명(snake_case) */
  id: string;
  /** 한글 표시명 */
  label: string;
  kind: IndicatorKind;
  /** SPC 관리도의 점 통계량으로 쓰기 적합한가(meta/n_samples 등은 false) */
  chartable: boolean;
  /** 한 줄 설명 */
  description: string;
  /**
   * 신호 컬럼 `col`에 대한 DuckDB 집계 표현식.
   * GROUP BY (웨이퍼×step) 위에서 평가된다.
   */
  sql: (col: string) => string;
}

/** IQR → σ 환산 상수(정규분포: IQR ≈ 1.349σ) */
const IQR_TO_SIGMA = 1.349;

/**
 * 표준 지표 카탈로그(표시 순서). 전부 아날로그/플래그 공통으로 계산되며,
 * 플래그 신호(0/1)에서는 mean = 가동비율(fraction-on)로 해석된다.
 */
export const INDICATORS: readonly IndicatorDef[] = [
  // ── 수준(level) ──
  { id: 'mean', label: '평균', kind: 'level', chartable: true,
    description: '구간 평균값(기본 FDC 지표).', sql: (c) => `avg(${c})` },
  { id: 'median', label: '중앙값', kind: 'level', chartable: true,
    description: '로버스트 중심값(이상치에 강함).', sql: (c) => `quantile_cont(${c}, 0.5)` },
  { id: 'start_val', label: '시작값', kind: 'level', chartable: true,
    description: '구간 첫 샘플값.', sql: (c) => `arg_min(${c}, processed_time)` },
  { id: 'end_val', label: '종료값', kind: 'level', chartable: true,
    description: '구간 마지막 샘플값(endpoint).', sql: (c) => `arg_max(${c}, processed_time)` },

  // ── 산포(dispersion) ──
  { id: 'std', label: '표준편차', kind: 'dispersion', chartable: true,
    description: '구간 내 변동(표본 std).', sql: (c) => `coalesce(stddev_samp(${c}), 0)` },
  { id: 'robust_std', label: '로버스트 std', kind: 'dispersion', chartable: true,
    description: 'IQR 기반 σ 추정(이상치에 강함).',
    sql: (c) => `coalesce((quantile_cont(${c}, 0.75) - quantile_cont(${c}, 0.25)) / ${IQR_TO_SIGMA}, 0)` },
  { id: 'min_val', label: '최소', kind: 'dispersion', chartable: true,
    description: '구간 최소값.', sql: (c) => `min(${c})` },
  { id: 'max_val', label: '최대', kind: 'dispersion', chartable: true,
    description: '구간 최대값.', sql: (c) => `max(${c})` },
  { id: 'range_val', label: '범위', kind: 'dispersion', chartable: true,
    description: '최대−최소.', sql: (c) => `max(${c}) - min(${c})` },
  { id: 'p05', label: '5퍼센타일', kind: 'dispersion', chartable: true,
    description: '하위 5% 분위.', sql: (c) => `quantile_cont(${c}, 0.05)` },
  { id: 'p95', label: '95퍼센타일', kind: 'dispersion', chartable: true,
    description: '상위 5% 분위.', sql: (c) => `quantile_cont(${c}, 0.95)` },
  { id: 'rms', label: 'RMS', kind: 'dispersion', chartable: true,
    description: '제곱평균제곱근(에너지).', sql: (c) => `sqrt(avg(${c} * ${c}))` },

  // ── 형상/동특성(shape) ──
  { id: 'slope', label: '기울기', kind: 'shape', chartable: true,
    description: '구간 선형 추세(단위/초). 드리프트 검출.',
    sql: (c) => `coalesce(regr_slope(${c}, epoch(processed_time)), 0)` },
  { id: 'area', label: '면적(적분)', kind: 'shape', chartable: true,
    description: '구간 합(∫ 근사). 누적 노출량.', sql: (c) => `sum(${c})` },
  { id: 'overshoot', label: '오버슈트', kind: 'shape', chartable: true,
    description: '최대−평균(상향 피크 초과).', sql: (c) => `max(${c}) - avg(${c})` },
  { id: 'undershoot', label: '언더슈트', kind: 'shape', chartable: true,
    description: '평균−최소(하향 피크 초과).', sql: (c) => `avg(${c}) - min(${c})` },
  { id: 'rate_of_change', label: '변화율', kind: 'shape', chartable: true,
    description: '(종료값−시작값)/구간시간(초).',
    sql: (c) =>
      `(arg_max(${c}, processed_time) - arg_min(${c}, processed_time)) ` +
      `/ nullif(date_diff('millisecond', min(processed_time), max(processed_time)) / 1000.0, 0)` },

  // ── 메타(meta) ──
  { id: 'n_samples', label: '샘플 수', kind: 'meta', chartable: false,
    description: '구간 비결측 샘플 수.', sql: (c) => `count(${c})` },
  { id: 'step_duration_s', label: '구간 길이(초)', kind: 'meta', chartable: true,
    description: '구간 첫~끝 경과 시간.',
    sql: () => `date_diff('millisecond', min(processed_time), max(processed_time)) / 1000.0` },
] as const;

/** chartable 지표만(관리도 점 통계량 후보) */
export const CHARTABLE_INDICATORS: readonly IndicatorDef[] = INDICATORS.filter(
  (i) => i.chartable,
);

/** 기본 지표(레거시 호환: step 평균) */
export const DEFAULT_INDICATOR = 'mean';

const INDICATOR_BY_ID = new Map<string, IndicatorDef>(
  INDICATORS.map((i) => [i.id, i]),
);

/** 유효 지표 id 집합(인젝션 방지 화이트리스트) */
export const INDICATOR_IDS: readonly string[] = INDICATORS.map((i) => i.id);

/** 지표 id 화이트리스트 검증 후 정의 반환 */
export function assertIndicator(id: string): IndicatorDef {
  const def = INDICATOR_BY_ID.get(id);
  if (!def) throw new Error(`알 수 없는 지표 id: ${id}`);
  return def;
}

export function getIndicator(id: string): IndicatorDef | undefined {
  return INDICATOR_BY_ID.get(id);
}
