/**
 * 수치 설명 레이어 — 순수 함수.
 *
 * 모든 핵심 지표를 "이 숫자가 무슨 뜻인지" 평이한 한국어 한 줄로 설명한다.
 * UI 툴팁/리드아웃에서 그대로 쓴다. 도메인 비전문가도 납득 가능하게.
 */

import type { ControlLimits } from './types';

/** σ(시그마) 설명 */
export function explainSigma(sigma: number): string {
  return `σ(시그마)=${sigma.toExponential(2)}: 웨이퍼 간 평균적인 흔들림 크기입니다. 관리 한계폭은 이 값의 ±3배(총 6σ)로 잡습니다.`;
}

/** 관리한계 설명 */
export function explainLimits(limits: ControlLimits): string {
  const band = (limits.ucl - limits.lcl).toExponential(2);
  return `중심선 CL=${limits.centerLine.toFixed(3)}, 상한 UCL=${limits.ucl.toFixed(3)}, 하한 LCL=${limits.lcl.toFixed(3)} (폭 ${band}). 이 범위 안이면 "평소와 같은 정상 변동"으로 봅니다. 규격(합격선)과는 다른, 공정 안정성 기준선입니다.`;
}

/** 점 개수/안정성 설명 */
export function explainStability(n: number, insufficient: boolean): string {
  if (insufficient) {
    return `점 ${n}개: 통계적으로 한계를 신뢰하기엔 적습니다(8개 미만). 더 많은 웨이퍼가 쌓이면 한계가 안정됩니다.`;
  }
  return `점 ${n}개: 한계를 산출하기에 충분합니다.`;
}

/** ARL 설명(벤치마크 표시용) */
export function explainArl(arl0: number, arl1: number): string {
  return `ARL₀=${arl0.toFixed(0)}: 정상인데도 평균 ${arl0.toFixed(0)}점마다 한 번 거짓 알람이 납니다(클수록 좋음). ARL₁=${arl1.toFixed(1)}: 진짜 이상이 생기면 평균 ${arl1.toFixed(1)}점 만에 잡습니다(작을수록 좋음).`;
}

/** T² 설명(다변량) */
export function explainT2(): string {
  return 'Hotelling T²: 여러 센서를 한 숫자로 합친 "종합 이상도"입니다. 센서들의 평소 상관관계까지 고려해, 개별로는 정상이어도 조합이 이상하면 잡아냅니다.';
}

/** SPE/Q 설명(다변량) */
export function explainSpe(): string {
  return 'SPE(Q 통계량): 주성분 모델로 설명되지 않는 "잔차 에너지"입니다. 평소 없던 새로운 형태의 이상(상관구조 붕괴)을 잡습니다. T²와 짝으로 봅니다.';
}

/** 기여도 설명(다변량 root-cause) */
export function explainContribution(topSignal: string, pct: number): string {
  return `기여도 1위: ${topSignal} (${pct.toFixed(0)}%). 이번 이상 신호에 이 센서가 가장 크게 기여했습니다 — 우선 점검 대상입니다.`;
}
