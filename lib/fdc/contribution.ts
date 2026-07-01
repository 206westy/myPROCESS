/**
 * 기여도 분해(root-cause) — 순수 함수.
 *
 * T²/SPE 알람이 떴을 때 "어느 센서가 원인인가"를 정량화한다.
 *  - SPE 기여도: 표준화 잔차 제곱 r_j² (직관적·표준 방법).
 *  - T² 기여도: 각 변수의 점수 기여 근사(표준화 잔차 + 점수 가중).
 * 여기서는 해석이 명확한 SPE 잔차 기반 기여도를 기본으로 신호 순위를 만든다.
 */

import type { MspcModel, MspcPoint } from './mspc';

export interface SignalContribution {
  signal: string;
  /** 기여도 절대값 */
  value: number;
  /** 전체 대비 백분율 */
  percent: number;
}

/**
 * 결합 기여도 = SPE 기여(잔차²) + T² 기여(모델 내부).
 *  - SPE 기여: residual_j² — 상관구조를 깬 변수(모델 밖 이상)를 지목.
 *  - T² 기여: z_j · Σ_i (loading_ji · score_i / λ_i) — 모델 내부에서 크게
 *    움직인 변수를 지목(양의 기여만 취함).
 * 둘을 합치면 모델 내부/외부 이상을 모두 올바른 신호로 귀속시킨다.
 */
export function combinedContributions(
  point: MspcPoint,
  model: MspcModel,
  signals: readonly string[],
): SignalContribution[] {
  const { loadings, eigenvalues, k } = model.pca;
  const p = model.pca.p;
  const raw: number[] = [];
  for (let j = 0; j < p; j += 1) {
    const spe = point.residual[j] * point.residual[j];
    let t2 = 0;
    for (let i = 0; i < k; i += 1) {
      const lambda = eigenvalues[i] || 1e-12;
      t2 += loadings[j][i] * point.scoreVec[i] / lambda;
    }
    const t2Contrib = Math.max(0, point.z[j] * t2);
    raw.push(spe + t2Contrib);
  }
  const total = raw.reduce((s, v) => s + v, 0) || 1;
  return raw
    .map((v, j) => ({ signal: signals[j] ?? `var_${j}`, value: v, percent: (v / total) * 100 }))
    .sort((a, b) => b.value - a.value);
}

/**
 * 잔차 벡터 + 신호명으로 기여도 순위(내림차순)를 만든다.
 * residual: 표준화 잔차(MspcPoint.residual), signals: 동일 순서의 신호명.
 */
export function rankContributions(
  residual: readonly number[],
  signals: readonly string[],
): SignalContribution[] {
  const sq = residual.map((r) => r * r);
  const total = sq.reduce((s, v) => s + v, 0) || 1;
  return sq
    .map((v, j) => ({
      signal: signals[j] ?? `var_${j}`,
      value: v,
      percent: (v / total) * 100,
    }))
    .sort((a, b) => b.value - a.value);
}

/** 상위 N개 기여 신호만 */
export function topContributions(
  contributions: readonly SignalContribution[],
  n = 5,
): SignalContribution[] {
  return contributions.slice(0, n);
}
