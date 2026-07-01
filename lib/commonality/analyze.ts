/**
 * Commonality 분석 — 순수 함수.
 *
 * "이상 웨이퍼들이 어떤 컨텍스트(recipe/stage/step/챔버/lot/시간)에 몰려 있나?"
 * 를 답한다. 수율 데이터가 없으므로 이상(bad) 집합은 트레이스 지표의
 * **컨텍스트 내 로버스트 이상치**(median+MAD z)로 정의한다.
 *
 * 방법(Honeycomb BubbleUp + 반도체 commonality의 bad/good ratio-gap):
 *   - 각 컨텍스트(recipe×stage×step) 안에서 robustZ = 0.6745·(x−median)/MAD.
 *   - |z| > k 인 웨이퍼-step을 anomaly로 표시.
 *   - 차원값별로 (anomaly 비율 − normal 비율) = ratioGap 을 산출하고
 *     2-비율 z-검정으로 유의성을, 최소 표본수로 노이즈를 가드한다.
 */

import { median, quantile, sampleStd } from '../spc/stats';

/** MAD→σ 환산: σ ≈ MAD / 0.6745 */
const MAD_SIGMA_DIV = 0.6745;
/** IQR→σ 환산: σ ≈ IQR / 1.349 */
const IQR_SIGMA_DIV = 1.349;

/**
 * 로버스트 σ 추정(티어드). MAD가 0이면(동일값 과반) IQR, 그것도 0이면
 * 표본 std로 폴백한다. 이상치 검출의 스케일 붕괴를 막는다.
 */
export function robustSigma(xs: readonly number[], med?: number): number {
  const m = med ?? median(xs);
  const mad = median(xs.map((x) => Math.abs(x - m)));
  let sigma = mad / MAD_SIGMA_DIV;
  if (sigma === 0) sigma = (quantile(xs, 0.75) - quantile(xs, 0.25)) / IQR_SIGMA_DIV;
  if (sigma === 0) sigma = sampleStd(xs);
  // 사실상 0(부동소수 잡음 수준)인 스케일은 0으로 간주 — z 폭발 방지
  const eps = 1e-9 * (Math.abs(m) + 1);
  return sigma <= eps ? 0 : sigma;
}

/** 컨텍스트 내 로버스트 이상치 판정에 필요한 최소 웨이퍼 수 */
export const MIN_GROUP_FOR_ANOMALY = 4;

/** 분석 입력 1행 = 한 웨이퍼-step의 지표값 + 차원들 */
export interface CommonalityRow {
  /** 컨텍스트 내 이상치 판정 그룹 키(recipe|stage|step) */
  contextKey: string;
  /** 지표값 */
  value: number;
  /** 차원(dimension name → value) — 과대표집 후보 */
  dimensions: Record<string, string>;
}

/** 이상치 표시된 행 */
export interface MarkedRow extends CommonalityRow {
  robustZ: number;
  isBad: boolean;
}

/** 중앙절대편차(MAD) */
export function medianAbsoluteDeviation(xs: readonly number[], med?: number): number {
  if (xs.length === 0) return Number.NaN;
  const m = med ?? median(xs);
  return median(xs.map((x) => Math.abs(x - m)));
}

/**
 * 컨텍스트별로 묶어 로버스트 z를 계산하고 |z|>k 를 이상으로 표시.
 * MAD=0(변동 없음)인 그룹은 이상 없음으로 처리(거짓양성 방지).
 */
export function markAnomalies(rows: readonly CommonalityRow[], k = 3.5): MarkedRow[] {
  const groups = new Map<string, CommonalityRow[]>();
  for (const r of rows) {
    const g = groups.get(r.contextKey);
    if (g) g.push(r);
    else groups.set(r.contextKey, [r]);
  }

  const out: MarkedRow[] = [];
  for (const group of groups.values()) {
    const values = group.map((r) => r.value);
    const med = median(values);
    // 표본 부족 그룹은 로버스트 추정 불가 → 이상 판정 안 함(거짓양성 방지)
    const sigma = group.length >= MIN_GROUP_FOR_ANOMALY ? robustSigma(values, med) : 0;
    for (const r of group) {
      const robustZ = sigma > 0 ? (r.value - med) / sigma : 0;
      out.push({ ...r, robustZ, isBad: sigma > 0 && Math.abs(robustZ) > k });
    }
  }
  return out;
}

/** 한 차원값의 과대표집 결과 */
export interface DimensionFinding {
  dimension: string;
  value: string;
  /** anomaly 집합 내 이 값의 개수 */
  badCount: number;
  /** normal 집합 내 이 값의 개수 */
  goodCount: number;
  /** anomaly 중 비율 */
  badRatio: number;
  /** normal 중 비율 */
  goodRatio: number;
  /** badRatio − goodRatio (양수=이상에 과대표집) */
  ratioGap: number;
  /** 2-비율 z 통계량 */
  z: number;
  /** |z| ≥ 1.96 (≈95%) */
  significant: boolean;
  /** 총 등장 수(최소표본 가드용) */
  support: number;
}

/** 표준정규 2-비율 z-검정 */
function twoProportionZ(a: number, nA: number, b: number, nB: number): number {
  if (nA === 0 || nB === 0) return 0;
  const p1 = a / nA;
  const p2 = b / nB;
  const pooled = (a + b) / (nA + nB);
  const denom = Math.sqrt(pooled * (1 - pooled) * (1 / nA + 1 / nB));
  return denom === 0 ? 0 : (p1 - p2) / denom;
}

export interface CommonalityResult {
  totalRows: number;
  badRows: number;
  goodRows: number;
  findings: DimensionFinding[];
}

/**
 * 표시된 행으로부터 차원별 ratio-gap 순위를 산출.
 * minSupport 미만 등장 값은 제외(소표본 노이즈 차단).
 */
export function commonality(
  marked: readonly MarkedRow[],
  dimensions: readonly string[],
  minSupport = 3,
): CommonalityResult {
  const bad = marked.filter((r) => r.isBad);
  const good = marked.filter((r) => !r.isBad);
  const nBad = bad.length;
  const nGood = good.length;

  const findings: DimensionFinding[] = [];

  for (const dim of dimensions) {
    const badCounts = new Map<string, number>();
    const goodCounts = new Map<string, number>();
    for (const r of bad) {
      const v = r.dimensions[dim];
      if (v !== undefined) badCounts.set(v, (badCounts.get(v) ?? 0) + 1);
    }
    for (const r of good) {
      const v = r.dimensions[dim];
      if (v !== undefined) goodCounts.set(v, (goodCounts.get(v) ?? 0) + 1);
    }
    const values = new Set<string>([...badCounts.keys(), ...goodCounts.keys()]);
    for (const value of values) {
      const badCount = badCounts.get(value) ?? 0;
      const goodCount = goodCounts.get(value) ?? 0;
      const support = badCount + goodCount;
      if (support < minSupport) continue;
      const badRatio = nBad === 0 ? 0 : badCount / nBad;
      const goodRatio = nGood === 0 ? 0 : goodCount / nGood;
      const z = twoProportionZ(badCount, nBad, goodCount, nGood);
      findings.push({
        dimension: dim,
        value,
        badCount,
        goodCount,
        badRatio,
        goodRatio,
        ratioGap: badRatio - goodRatio,
        z,
        significant: Math.abs(z) >= 1.96,
        support,
      });
    }
  }

  // 과대표집(양의 gap) 우선, gap 큰 순 → 유의성 순
  findings.sort(
    (a, b) => b.ratioGap - a.ratioGap || Math.abs(b.z) - Math.abs(a.z),
  );

  return { totalRows: marked.length, badRows: nBad, goodRows: nGood, findings };
}
