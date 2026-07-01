/**
 * 변동 분해 + 한계 신뢰도(Trust Score) — 순수 함수.
 *
 * 핵심 통찰: I-MR 관리한계는 σ_within = MR_bar/d2 (연속 웨이퍼 간 단기 변동)으로
 * 만든다. 그런데 컨텍스트가 드리프트/이질 모집단을 품으면 실제 전체 변동
 * σ_total(표본 표준편차)이 훨씬 커진다. 둘의 비율이 한계의 신뢰도다.
 *
 * 실측 사례: !!!!(IT)4%H2N2_BKM / PM2 Stage1 / step5 / Gas2_Monitor 에서
 * σ_within=0.30, σ_total=2.07 → ratio≈6.9 → 한계가 비현실적으로 좁아
 * 89점 중 71점(80%)이 거짓 이탈. 이 지표가 그런 상황을 자동 경고한다.
 */

import { sampleStd, sigmaFromMovingRange } from './stats';
import type { TrustGrade, TrustScore } from './types';

/** ratio 등급 임계값 */
const RATIO_MEDIUM = 1.5;
const RATIO_LOW = 3;

function gradeOf(ratio: number): TrustGrade {
  if (!Number.isFinite(ratio) || ratio < RATIO_MEDIUM) return 'high';
  if (ratio < RATIO_LOW) return 'medium';
  return 'low';
}

function explain(grade: TrustGrade, ratio: number, within: number, total: number): string {
  const r = Number.isFinite(ratio) ? ratio.toFixed(1) : '∞';
  const w = within.toExponential(2);
  const t = total.toExponential(2);
  if (grade === 'high') {
    return `한계 신뢰 높음: 전체 변동(${t})이 단기 변동(${w})의 ${r}배로 가깝습니다. I-MR 관리한계가 타당합니다.`;
  }
  if (grade === 'medium') {
    return `한계 신뢰 보통: 전체 변동이 단기 변동의 ${r}배입니다. 약한 드리프트/자기상관 가능성 — EWMA나 잔차 차트를 함께 보세요.`;
  }
  return `한계 신뢰 낮음(경고): 전체 변동이 단기 변동의 ${r}배입니다. 컨텍스트에 이질적 로트/웨이퍼가 섞였거나 큰 드리프트가 있어 I-MR 한계가 비현실적으로 좁습니다. 컨텍스트 세분화 또는 베이스라인 재설정이 필요합니다.`;
}

/**
 * 한 컨텍스트의 웨이퍼 점 값들로부터 변동 분해와 Trust Score를 산출.
 */
export function computeTrustScore(values: readonly number[]): TrustScore {
  const sigmaWithin = sigmaFromMovingRange(values);
  const sigmaTotal = sampleStd(values);
  // within이 0이면(완전 일정) 비율 정의 불가 → total도 0이면 1, 아니면 ∞
  const ratio =
    sigmaWithin === 0
      ? sigmaTotal === 0
        ? 1
        : Number.POSITIVE_INFINITY
      : sigmaTotal / sigmaWithin;
  const grade = gradeOf(ratio);
  return {
    sigmaWithin,
    sigmaTotal,
    ratio,
    grade,
    explanation: explain(grade, ratio, sigmaWithin, sigmaTotal),
  };
}
