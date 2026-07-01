/**
 * 규격(Spec)과 공정능력(Capability) — 순수 함수.
 *
 * 관리한계(공정의 목소리, 변함)와 달리 규격은 엔지니어/고객이 정한 고정선
 * (USL/LSL/Target)이다. 합격/불합격 판정과 Cp/Cpk는 규격 기준으로 한다.
 *
 * 규격 자동 유도: setpoint 신호(예: Gas2_Set)가 있으면 target=setpoint 평균,
 * 허용폭은 target의 ±tolPct% 로 둔다(없으면 수동 입력). 데이터 기반 가정임을
 * source 로 명시한다.
 */

import { mean, sampleStd, sigmaFromMovingRange } from './stats';
import type { Capability, SpecLimits } from './types';

/** setpoint 기반 기본 허용폭(±%) — 도메인 합의로 교체 가능 */
export const DEFAULT_TOL_PCT = 5;

/** 수동 규격 생성 */
export function manualSpec(
  target: number | null,
  usl: number | null,
  lsl: number | null,
): SpecLimits {
  return { target, usl, lsl, source: 'manual' };
}

/**
 * setpoint 값들에서 규격을 유도. setpoint가 일정하면 그 값을 target으로,
 * ±tolPct% 를 USL/LSL로 둔다. setpoint가 비었으면 null 규격.
 */
export function deriveSpecFromSetpoint(
  setpointValues: readonly number[],
  setpointSignal: string,
  tolPct = DEFAULT_TOL_PCT,
): SpecLimits {
  const usable = setpointValues.filter((v) => Number.isFinite(v));
  if (usable.length === 0) {
    return { target: null, usl: null, lsl: null, source: `${setpointSignal}(값 없음)` };
  }
  const target = mean(usable);
  const tol = Math.abs(target) * (tolPct / 100);
  return {
    target,
    usl: target + tol,
    lsl: target - tol,
    source: `${setpointSignal} 평균 ±${tolPct}%`,
  };
}

/**
 * 공정능력 산출.
 *  Cp  = (USL−LSL)/(6·σ_within)   — 단기(잠재) 능력
 *  Cpk = min(USL−μ, μ−LSL)/(3·σ_within) — 중심 이탈 반영 단기 능력
 *  Pp/Ppk = 위 식의 σ_total 버전 — 전체(실제) 성능
 * 규격이 한쪽만 있으면 가능한 지수만 산출.
 */
export function computeCapability(
  values: readonly number[],
  spec: SpecLimits,
): Capability {
  const mu = mean(values);
  const sigmaWithin = sigmaFromMovingRange(values);
  const sigmaTotal = sampleStd(values);
  const { usl, lsl } = spec;

  const both = usl !== null && lsl !== null;
  const cp = both && sigmaWithin > 0 ? (usl - lsl) / (6 * sigmaWithin) : null;
  const pp = both && sigmaTotal > 0 ? (usl - lsl) / (6 * sigmaTotal) : null;

  const cpkParts: number[] = [];
  const ppkParts: number[] = [];
  if (usl !== null && sigmaWithin > 0) cpkParts.push((usl - mu) / (3 * sigmaWithin));
  if (lsl !== null && sigmaWithin > 0) cpkParts.push((mu - lsl) / (3 * sigmaWithin));
  if (usl !== null && sigmaTotal > 0) ppkParts.push((usl - mu) / (3 * sigmaTotal));
  if (lsl !== null && sigmaTotal > 0) ppkParts.push((mu - lsl) / (3 * sigmaTotal));
  const cpk = cpkParts.length ? Math.min(...cpkParts) : null;
  const ppk = ppkParts.length ? Math.min(...ppkParts) : null;

  return { cp, cpk, pp, ppk, explanation: explainCapability(cpk, ppk) };
}

function explainCapability(cpk: number | null, ppk: number | null): string {
  if (cpk === null && ppk === null) {
    return '규격(USL/LSL)이 없어 공정능력을 계산할 수 없습니다. setpoint가 0이거나 규격 미설정입니다.';
  }
  const grade = (v: number | null) =>
    v === null ? '—' : v >= 1.33 ? '우수' : v >= 1.0 ? '보통' : '부족';
  return `Cpk=${cpk?.toFixed(2) ?? '—'}(단기, ${grade(cpk)}), Ppk=${ppk?.toFixed(2) ?? '—'}(전체, ${grade(ppk)}). 1.33↑ 우수, 1.0~1.33 보통, 1.0↓ 규격 이탈 위험. Cpk≫Ppk면 단기는 양호하나 장기 드리프트가 있다는 뜻입니다.`;
}
