/**
 * 합성 결함 주입 — 순수 함수(결정적).
 *
 * 라벨된 실제 결함이 없으므로, 정상 데이터(또는 정상 분포)에 "알려진"
 * 이상을 주입해 탐지 성능을 객관적으로 측정한다. 주입 위치를 알기에
 * 정밀도/재현율·탐지지연을 정확히 계산할 수 있다.
 *
 * 결정성: Math.random 사용 금지(워크플로/재현성). 시드 기반 LCG 난수를 쓴다.
 */

/** 결함 유형 */
export type FaultType = 'shift' | 'drift' | 'spike' | 'variance';

export interface FaultSpec {
  type: FaultType;
  /** 결함 시작 인덱스 */
  start: number;
  /** σ 단위 크기(shift/drift 기울기/spike 높이/variance 배수) */
  magnitude: number;
}

export interface InjectedSeries {
  values: number[];
  /** 결함이 적용된 인덱스 집합(라벨, 평가 정답) */
  faultyIndices: Set<number>;
  spec: FaultSpec;
}

/** 시드 LCG 난수 생성기(0~1) */
export function lcg(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** 표준정규 난수(Box-Muller) 생성기 */
export function gaussianGen(seed: number): () => number {
  const rand = lcg(seed);
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const v = spare;
      spare = null;
      return v;
    }
    let u = 0;
    let v = 0;
    let s = 0;
    do {
      u = rand() * 2 - 1;
      v = rand() * 2 - 1;
      s = u * u + v * v;
    } while (s === 0 || s >= 1);
    const mul = Math.sqrt((-2 * Math.log(s)) / s);
    spare = v * mul;
    return u * mul;
  };
}

/** 정상 정규 시계열 생성(평균 mu, 표준편차 sigma) */
export function normalSeries(
  n: number,
  mu: number,
  sigma: number,
  seed: number,
): number[] {
  const g = gaussianGen(seed);
  return Array.from({ length: n }, () => mu + sigma * g());
}

/**
 * 기존 값 배열에 결함을 주입. sigma는 결함 크기 환산 기준(보통 공정 σ).
 */
export function injectFault(
  base: readonly number[],
  spec: FaultSpec,
  sigma: number,
): InjectedSeries {
  const values = [...base];
  const faulty = new Set<number>();
  const n = values.length;
  for (let i = spec.start; i < n; i += 1) {
    switch (spec.type) {
      case 'shift':
        values[i] += spec.magnitude * sigma;
        faulty.add(i);
        break;
      case 'drift':
        values[i] += spec.magnitude * sigma * (i - spec.start + 1);
        faulty.add(i);
        break;
      case 'variance':
        values[i] = base[i] + (base[i] - mean(base)) * (spec.magnitude - 1);
        faulty.add(i);
        break;
      case 'spike':
        if (i === spec.start) {
          values[i] += spec.magnitude * sigma;
          faulty.add(i);
        }
        break;
    }
  }
  return { values, faultyIndices: faulty, spec };
}

function mean(xs: readonly number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
