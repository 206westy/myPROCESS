/**
 * PCA(주성분 분석) — 순수 함수, 외부 의존성 없음.
 *
 * 대칭 공분산 행렬의 고유분해는 Jacobi 회전법으로 구현한다(소~중 차원에
 * 충분히 안정·정확). 다변량 FDC의 기반: 120여 개 센서를 소수 주성분으로
 * 압축해 T²(모델 내부)와 SPE(모델 잔차)를 분리 모니터링한다.
 */

import { mean, sampleStd } from '../spc/stats';

export interface PcaModel {
  /** 각 변수 평균(표준화 복원용) */
  center: number[];
  /** 각 변수 표준편차 */
  scale: number[];
  /** 주성분 적재(열=주성분), eigenvectors[varIndex][compIndex] */
  loadings: number[][];
  /** 각 주성분 분산(고유값, 내림차순) */
  eigenvalues: number[];
  /** 보존 주성분 수 */
  k: number;
  /** 변수 수 */
  p: number;
  /** 분산 설명 누적비(보존 k개 기준) */
  explainedVarianceRatio: number;
}

/** 행렬(행=관측, 열=변수) 표준화 → {z, center, scale} */
function standardize(rows: number[][]): {
  z: number[][];
  center: number[];
  scale: number[];
} {
  const p = rows[0]?.length ?? 0;
  const center: number[] = [];
  const scale: number[] = [];
  for (let j = 0; j < p; j += 1) {
    const col = rows.map((r) => r[j]);
    const m = mean(col);
    const s = sampleStd(col) || 1; // 상수열은 1로(나눗셈 보호)
    center.push(m);
    scale.push(s);
  }
  const z = rows.map((r) => r.map((v, j) => (v - center[j]) / scale[j]));
  return { z, center, scale };
}

/** 표준화 행렬의 공분산(=상관) 행렬 p×p */
function covariance(z: number[][]): number[][] {
  const n = z.length;
  const p = z[0]?.length ?? 0;
  const cov: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  for (let a = 0; a < p; a += 1) {
    for (let b = a; b < p; b += 1) {
      let s = 0;
      for (let i = 0; i < n; i += 1) s += z[i][a] * z[i][b];
      const v = n > 1 ? s / (n - 1) : 0;
      cov[a][b] = v;
      cov[b][a] = v;
    }
  }
  return cov;
}

/** Jacobi 고유분해(대칭행렬). 반환: 고유값[] + 고유벡터(열) */
function jacobiEigen(
  matrix: number[][],
  maxIter = 100,
  tol = 1e-10,
): { values: number[]; vectors: number[][] } {
  const p = matrix.length;
  const a = matrix.map((r) => [...r]);
  // 단위행렬로 시작하는 고유벡터 누적
  const v: number[][] = Array.from({ length: p }, (_, i) =>
    Array.from({ length: p }, (_, j) => (i === j ? 1 : 0)),
  );

  for (let iter = 0; iter < maxIter; iter += 1) {
    // 비대각 최대 원소 찾기
    let p1 = 0;
    let q1 = 1;
    let off = 0;
    for (let i = 0; i < p; i += 1) {
      for (let j = i + 1; j < p; j += 1) {
        if (Math.abs(a[i][j]) > off) {
          off = Math.abs(a[i][j]);
          p1 = i;
          q1 = j;
        }
      }
    }
    if (off < tol) break;

    const app = a[p1][p1];
    const aqq = a[q1][q1];
    const apq = a[p1][q1];
    const phi = 0.5 * Math.atan2(2 * apq, aqq - app);
    const c = Math.cos(phi);
    const s = Math.sin(phi);

    for (let k = 0; k < p; k += 1) {
      const akp = a[k][p1];
      const akq = a[k][q1];
      a[k][p1] = c * akp - s * akq;
      a[k][q1] = s * akp + c * akq;
    }
    for (let k = 0; k < p; k += 1) {
      const apk = a[p1][k];
      const aqk = a[q1][k];
      a[p1][k] = c * apk - s * aqk;
      a[q1][k] = s * apk + c * aqk;
    }
    for (let k = 0; k < p; k += 1) {
      const vkp = v[k][p1];
      const vkq = v[k][q1];
      v[k][p1] = c * vkp - s * vkq;
      v[k][q1] = s * vkp + c * vkq;
    }
  }

  const values = a.map((_, i) => a[i][i]);
  return { values, vectors: v };
}

/** 분산 설명비로 보존 주성분 수 결정(기본 90%) */
function chooseK(eigenvalues: number[], threshold: number): number {
  const total = eigenvalues.reduce((x, y) => x + y, 0) || 1;
  let acc = 0;
  for (let i = 0; i < eigenvalues.length; i += 1) {
    acc += eigenvalues[i];
    if (acc / total >= threshold) return i + 1;
  }
  return eigenvalues.length;
}

/**
 * 표준화 PCA 모델 적합. rows: 행=관측(웨이퍼), 열=신호.
 * threshold: 보존 분산비(0~1).
 */
export function fitPca(rows: number[][], threshold = 0.9): PcaModel {
  const p = rows[0]?.length ?? 0;
  const { z, center, scale } = standardize(rows);
  const cov = covariance(z);
  const { values, vectors } = jacobiEigen(cov);

  // 고유값 내림차순 정렬, 벡터 동반 정렬
  const order = values
    .map((val, i) => ({ val, i }))
    .sort((x, y) => y.val - x.val);
  const eigenvalues = order.map((o) => Math.max(o.val, 0));
  const loadings = vectors.map((row) => order.map((o) => row[o.i]));

  const k = chooseK(eigenvalues, threshold);
  const total = eigenvalues.reduce((x, y) => x + y, 0) || 1;
  const explainedVarianceRatio =
    eigenvalues.slice(0, k).reduce((x, y) => x + y, 0) / total;

  return { center, scale, loadings, eigenvalues, k, p, explainedVarianceRatio };
}

/** 한 관측을 표준화 */
export function standardizeRow(row: number[], model: PcaModel): number[] {
  return row.map((v, j) => (v - model.center[j]) / model.scale[j]);
}

/** 표준화 관측 → 주성분 점수(보존 k개) */
export function scores(zRow: number[], model: PcaModel): number[] {
  const out: number[] = [];
  for (let comp = 0; comp < model.k; comp += 1) {
    let s = 0;
    for (let j = 0; j < model.p; j += 1) s += zRow[j] * model.loadings[j][comp];
    out.push(s);
  }
  return out;
}

/** 주성분 점수 → 표준화 공간 재구성(보존 k개 사용) */
export function reconstruct(scoreVec: number[], model: PcaModel): number[] {
  const out = new Array(model.p).fill(0);
  for (let j = 0; j < model.p; j += 1) {
    let s = 0;
    for (let comp = 0; comp < model.k; comp += 1) {
      s += scoreVec[comp] * model.loadings[j][comp];
    }
    out[j] = s;
  }
  return out;
}
