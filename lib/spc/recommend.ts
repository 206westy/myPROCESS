/**
 * 차트 추천기 — 순수 함수.
 *
 * 진단(자기상관/변화점)과 Trust Score를 근거로 가장 적합한 관리도를
 * "이유와 함께" 추천한다. 규칙 기반이라 설명·재현이 명확하다.
 *
 * 결정 논리:
 *  1) 자기상관 유의 → 잔차 차트(자기상관 제거가 우선)
 *  2) 한계 신뢰 낮음(드리프트/이질) → 잔차 차트 권고 + 컨텍스트 경고
 *  3) 그 외 작은 시프트 민감도가 필요 → EWMA(기본 추천)
 *  4) I-MR 은 항상 대안으로 제시(개별값 가시성)
 */

import type {
  ChartRecommendation,
  ChartType,
  Diagnostics,
  TrustScore,
} from './types';

export function recommendChart(
  diag: Diagnostics,
  trust: TrustScore,
): ChartRecommendation {
  const alternatives: ChartType[] = ['imr', 'ewma', 'cusum', 'residual'];

  if (diag.autocorrSignificant) {
    return {
      recommended: 'residual',
      reason: `lag-1 자기상관(ρ₁=${diag.lag1Autocorr.toFixed(2)})이 유의합니다. 원신호는 독립 가정을 어겨 I-MR 한계가 부정확하므로, AR(1) 잔차 차트로 자기상관을 제거하고 모니터링하는 것이 옳습니다.`,
      alternatives: alternatives.filter((a) => a !== 'residual'),
    };
  }

  if (trust.grade === 'low') {
    return {
      recommended: 'residual',
      reason: `한계 신뢰가 낮습니다(전체/단기 변동비 ${Number.isFinite(trust.ratio) ? trust.ratio.toFixed(1) : '∞'}배). 드리프트 또는 이질 모집단 가능성이 큽니다. 잔차 차트로 추세를 제거하거나 컨텍스트를 세분화하세요.`,
      alternatives: alternatives.filter((a) => a !== 'residual'),
    };
  }

  if (diag.changePointIndex !== null) {
    return {
      recommended: 'cusum',
      reason: `인덱스 ${diag.changePointIndex} 부근에 레벨 시프트 후보가 있습니다. CUSUM은 작은 지속 시프트를 누적해 빠르게 잡아냅니다.`,
      alternatives: alternatives.filter((a) => a !== 'cusum'),
    };
  }

  return {
    recommended: 'ewma',
    reason: `자기상관·드리프트 징후가 약하고 한계 신뢰가 ${trust.grade === 'high' ? '높습니다' : '보통입니다'}. 작은 시프트까지 빠르게 보려면 EWMA가 적합하며, 개별값 가시성은 I-MR로 보완하세요.`,
    alternatives: alternatives.filter((a) => a !== 'ewma'),
  };
}
