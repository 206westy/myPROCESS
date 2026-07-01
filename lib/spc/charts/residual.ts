/**
 * 잔차 관리도 — 순수 함수.
 *
 * 자기상관(드리프트) 공정에서는 원신호에 직접 I-MR을 적용하면 한계가
 * 왜곡된다. AR(1) 모델로 예측 후 잔차(e_t = x_t − x̂_t)에 I-MR을 적용하면
 * 잔차는 백색잡음에 가까워 한계가 타당해진다(잔차 기반 관리도).
 *
 * 한계는 잔차의 이동범위 σ로 산출하며 0을 중심으로 한 고정 폭이다.
 */

import { ar1Fit, sigmaFromMovingRange, SIGMA_K } from './../stats';
import type { SeriesChart, Violation, WaferPoint } from './../types';

export function buildResidualChart(points: readonly WaferPoint[]): SeriesChart {
  const values = points.map((p) => p.value);
  const { phi, residuals } = ar1Fit(values);
  // 첫 점(잔차 0, 예측불가)은 한계 산출에서 제외
  const usable = residuals.slice(1);
  const sigma = sigmaFromMovingRange(usable);
  const halfWidth = SIGMA_K * sigma;

  const statistic = residuals;
  const ucl = residuals.map(() => halfWidth);
  const lcl = residuals.map(() => -halfWidth);

  const violations: Violation[] = [];
  if (sigma > 0) {
    for (let i = 1; i < residuals.length; i += 1) {
      if (residuals[i] > halfWidth || residuals[i] < -halfWidth) {
        violations.push({
          index: i,
          rule: 'beyond_3sigma',
          message: '잔차가 3σ 한계를 벗어남(자기상관 보정 후 진짜 이상)',
          severity: 'alarm',
        });
      }
    }
  }

  return {
    type: 'residual',
    statistic,
    centerLine: 0,
    ucl,
    lcl,
    violations,
    description: `잔차 차트(AR(1), φ=${phi.toFixed(2)}): 직전 값으로 다음 값을 예측한 뒤 그 오차(잔차)를 관리합니다. 드리프트/자기상관을 제거해, 추세가 아닌 "진짜 이상"만 한계를 벗어납니다. 0이 중심이고 한계폭은 잔차 σ=${sigma.toExponential(2)} 기준입니다.`,
  };
}
