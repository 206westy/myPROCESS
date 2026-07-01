/**
 * 다변량 FDC 서비스 — 순수 조립(데이터 접근과 분리).
 *
 * 입력: 베이스라인 행렬(정상 웨이퍼×신호) + 평가 행렬(전체 웨이퍼×신호).
 * 출력: 웨이퍼별 T²/SPE + 알람 + 기여도 root-cause.
 * 데이터 조회는 호출 측(Phase 7 queries)에서 행렬을 만들어 넘긴다.
 */

import { fitMspc, evaluatePoint, nonConstantColumns, type MspcModel } from './mspc';
import {
  combinedContributions,
  topContributions,
  type SignalContribution,
} from './contribution';

export interface FdcWaferResult {
  index: number;
  t2: number;
  spe: number;
  t2Alarm: boolean;
  speAlarm: boolean;
  /** 알람 시 상위 기여 신호(정상이면 빈 배열) */
  topCauses: SignalContribution[];
}

export interface FdcResult {
  signals: string[];
  t2Limit: number;
  speLimit: number;
  k: number;
  explainedVarianceRatio: number;
  nBaseline: number;
  results: FdcWaferResult[];
}

/**
 * 베이스라인으로 MSPC 모델을 적합하고 평가 행렬을 점별 분석.
 * 분산 0 신호열은 자동 제외(PCA 불가).
 */
export function runFdc(
  baselineRows: number[][],
  evalRows: number[][],
  signals: readonly string[],
  opts: { confidence?: number; threshold?: number; topN?: number } = {},
): FdcResult {
  const keep = nonConstantColumns(baselineRows);
  const keptSignals = keep.map((j) => signals[j] ?? `var_${j}`);
  const baseKept = baselineRows.map((r) => keep.map((j) => r[j]));
  const evalKept = evalRows.map((r) => keep.map((j) => r[j]));

  const model: MspcModel = fitMspc(baseKept, opts.confidence, opts.threshold);
  const topN = opts.topN ?? 5;

  const results: FdcWaferResult[] = evalKept.map((row, i) => {
    const pt = evaluatePoint(row, model);
    const alarm = pt.t2Alarm || pt.speAlarm;
    const topCauses = alarm
      ? topContributions(combinedContributions(pt, model, keptSignals), topN)
      : [];
    return {
      index: i,
      t2: pt.t2,
      spe: pt.spe,
      t2Alarm: pt.t2Alarm,
      speAlarm: pt.speAlarm,
      topCauses,
    };
  });

  return {
    signals: keptSignals,
    t2Limit: model.t2Limit,
    speLimit: model.speLimit,
    k: model.pca.k,
    explainedVarianceRatio: model.pca.explainedVarianceRatio,
    nBaseline: model.nBaseline,
    results,
  };
}
