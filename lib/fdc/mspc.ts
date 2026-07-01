/**
 * 다변량 SPC(MSPC) — Hotelling T² + SPE(Q) — 순수 함수.
 *
 * PCA 모델 위에서 각 웨이퍼를 두 통계량으로 모니터링한다:
 *  - T² (모델 내부): 보존 주성분 점수의 정규화 제곱합 Σ score_i²/λ_i.
 *    센서들의 평소 상관까지 고려한 "종합 이상도". 한계는 F분포 근사.
 *  - SPE/Q (모델 잔차): 재구성 오차 제곱합. 평소 없던 새 패턴(상관붕괴)을 잡음.
 *    한계는 Jackson-Mudholkar 근사.
 *
 * 한계는 베이스라인(정상) 데이터로 적합한 모델·분포에서 산출한다.
 */

import { sampleVariance } from '../spc/stats';
import {
  fitPca,
  reconstruct,
  scores,
  standardizeRow,
  type PcaModel,
} from './pca';

/** 신뢰수준(거짓알람률 α=1−level) */
export const MSPC_CONFIDENCE = 0.99;

export interface MspcModel {
  pca: PcaModel;
  t2Limit: number;
  speLimit: number;
  /** 베이스라인 관측 수 */
  nBaseline: number;
  confidence: number;
}

export interface MspcPoint {
  t2: number;
  spe: number;
  t2Alarm: boolean;
  speAlarm: boolean;
  /** 표준화 관측 z(기여도 계산용) */
  z: number[];
  /** 표준화 잔차(SPE 기여도용) */
  residual: number[];
  /** 보존 주성분 점수(T² 기여도용) */
  scoreVec: number[];
  /** 정규화 점수 score²/λ */
  normalizedScores: number[];
}

/** F분포 상위분위 근사(Wilson-Hilferty). df1, df2, p=상위확률(예: 0.01) */
function fQuantile(df1: number, df2: number, upperP: number): number {
  // 카이제곱 분위(WH) 후 F 근사. 간이지만 관리도 한계 용도로 충분.
  const z = normalQuantile(1 - upperP);
  const chi = (df: number) => {
    const a = 2 / (9 * df);
    return df * Math.pow(1 - a + z * Math.sqrt(a), 3);
  };
  const c1 = chi(df1) / df1;
  const c2 = chi(df2) / df2;
  return c2 === 0 ? c1 : c1 / c2;
}

/** 표준정규 분위수(Acklam 근사) */
export function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const plow = 0.02425;
  const phigh = 1 - plow;
  let q: number;
  let r: number;
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= phigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

/** T² 한계: (k(n²−1))/(n(n−k)) · F_{k,n−k,α} */
function t2ControlLimit(n: number, k: number, confidence: number): number {
  if (n <= k) return Infinity;
  const f = fQuantile(k, n - k, 1 - confidence);
  return (k * (n * n - 1)) / (n * (n - k)) * f;
}

/** SPE 한계: Jackson-Mudholkar(잔차 고유값 θ1,θ2,θ3 기반) */
function speControlLimit(model: PcaModel, confidence: number): number {
  const residualEig = model.eigenvalues.slice(model.k);
  if (residualEig.length === 0) return 0;
  const theta1 = residualEig.reduce((s, l) => s + l, 0);
  const theta2 = residualEig.reduce((s, l) => s + l * l, 0);
  const theta3 = residualEig.reduce((s, l) => s + l * l * l, 0);
  if (theta1 === 0) return 0;
  const h0 = 1 - (2 * theta1 * theta3) / (3 * theta2 * theta2);
  const ca = normalQuantile(confidence);
  const term1 = (ca * Math.sqrt(2 * theta2 * h0 * h0)) / theta1;
  const term2 = (theta2 * h0 * (h0 - 1)) / (theta1 * theta1);
  return theta1 * Math.pow(term1 + 1 + term2, 1 / h0);
}

/** 한 관측의 T²/SPE 산출 */
export function evaluatePoint(row: number[], model: MspcModel): MspcPoint {
  const z = standardizeRow(row, model.pca);
  const sc = scores(z, model.pca);
  const recon = reconstruct(sc, model.pca);
  const residual = z.map((v, j) => v - recon[j]);
  const spe = residual.reduce((s, r) => s + r * r, 0);

  const normalizedScores: number[] = [];
  let t2 = 0;
  for (let comp = 0; comp < model.pca.k; comp += 1) {
    const lambda = model.pca.eigenvalues[comp] || 1e-12;
    const norm = (sc[comp] * sc[comp]) / lambda;
    normalizedScores.push(norm);
    t2 += norm;
  }

  return {
    t2,
    spe,
    t2Alarm: t2 > model.t2Limit,
    speAlarm: spe > model.speLimit,
    z,
    residual,
    scoreVec: sc,
    normalizedScores,
  };
}

/**
 * 베이스라인(정상) 행렬로 MSPC 모델 적합.
 * rows: 행=웨이퍼, 열=신호. threshold: PCA 보존 분산비.
 */
export function fitMspc(
  rows: number[][],
  confidence = MSPC_CONFIDENCE,
  threshold = 0.9,
): MspcModel {
  const pca = fitPca(rows, threshold);
  const n = rows.length;
  const t2Limit = t2ControlLimit(n, pca.k, confidence);
  const speLimit = speControlLimit(pca, confidence);
  return { pca, t2Limit, speLimit, nBaseline: n, confidence };
}

/** 상수 신호 열 제거 후 유효 열 인덱스 반환(분산 0 열은 PCA 불가) */
export function nonConstantColumns(rows: number[][]): number[] {
  const p = rows[0]?.length ?? 0;
  const keep: number[] = [];
  for (let j = 0; j < p; j += 1) {
    if (sampleVariance(rows.map((r) => r[j])) > 0) keep.push(j);
  }
  return keep;
}
