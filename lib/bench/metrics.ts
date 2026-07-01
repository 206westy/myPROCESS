/**
 * 탐지 성능 지표 — 순수 함수.
 *
 * 주입된 결함(정답 라벨)과 차트 위반(예측)을 비교해 객관 지표를 산출.
 *  - 정밀도/재현율/F1: 위반 점 단위 분류 성능.
 *  - MTTD(평균 탐지 지연): 결함 시작 후 첫 알람까지 걸린 점 수.
 *  - FAR: 정상 구간에서 알람이 난 비율(거짓경보율).
 */

export interface DetectionMetrics {
  precision: number;
  recall: number;
  f1: number;
  /** 탐지 지연(점 수). 미탐지면 null */
  detectionDelay: number | null;
  /** 거짓경보율(정상 점 중 알람 비율) */
  falseAlarmRate: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
}

/**
 * faultyIndices(정답) vs alarmIndices(예측)으로 지표 계산.
 * faultStart: 결함 시작 인덱스(탐지지연 기준).
 */
export function detectionMetrics(
  faultyIndices: ReadonlySet<number>,
  alarmIndices: ReadonlySet<number>,
  total: number,
  faultStart: number,
): DetectionMetrics {
  let tp = 0;
  let fp = 0;
  for (const i of alarmIndices) {
    if (faultyIndices.has(i)) tp += 1;
    else fp += 1;
  }
  const fn = faultyIndices.size - tp;

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = faultyIndices.size > 0 ? tp / faultyIndices.size : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  // 탐지 지연: 결함 시작 이후 첫 알람
  let detectionDelay: number | null = null;
  for (let i = faultStart; i < total; i += 1) {
    if (alarmIndices.has(i)) {
      detectionDelay = i - faultStart;
      break;
    }
  }

  // 거짓경보율: 정상 점(결함 아님) 중 알람 비율
  const normalCount = total - faultyIndices.size;
  let falseAlarmsInNormal = 0;
  for (const i of alarmIndices) {
    if (!faultyIndices.has(i)) falseAlarmsInNormal += 1;
  }
  const falseAlarmRate = normalCount > 0 ? falseAlarmsInNormal / normalCount : 0;

  return {
    precision,
    recall,
    f1,
    detectionDelay,
    falseAlarmRate,
    truePositives: tp,
    falsePositives: fp,
    falseNegatives: fn,
  };
}
