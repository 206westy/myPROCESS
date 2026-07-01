/**
 * 장비 상태/가동 재구성 — 순수 함수.
 *
 * 데이터는 설비 트레이스뿐이라(이벤트 로그/MES 없음) 웨이퍼 런의 처리
 * 구간(첫~끝 샘플 시각)으로 가동(productive)/유휴(idle) 타임라인을
 * **재구성**한다. SEMI E10 상태 모델에서 영감을 받되, 실제 E10 상태
 * 천이가 아니라 트레이스 기반 근사임을 분명히 한다.
 *
 * 핵심 지표: 가동률(utilization), 평균 런 간격(MTBA-like), 처리량,
 * 최장 유휴(잠재 다운타임/정비 창).
 */

/** 한 웨이퍼 런의 처리 구간(epoch ms) */
export interface RunInterval {
  startMs: number;
  endMs: number;
}

/** 런 사이 유휴 간격 */
export interface IdleGap {
  /** 이 간격 앞 런의 인덱스(정렬 기준) */
  afterIndex: number;
  startMs: number;
  gapMs: number;
  /** 임계 초과(잠재 다운타임) */
  isDowntime: boolean;
}

export interface EquipmentStats {
  runs: number;
  spanMs: number;
  productiveMs: number;
  idleMs: number;
  /** 가동률 = productive / span (0~1) */
  utilization: number;
  meanRunMs: number;
  /** 평균 런 간격(연속 런 시작 간 평균) — MTBF 대용(고장 데이터 없음) */
  meanIntervalMs: number;
  longestGapMs: number;
  /** 최장 유휴 시작 시각(ms), 없으면 null */
  longestGapAtMs: number | null;
  gaps: IdleGap[];
  /** 다운타임 임계(ms) — 가동률 분모엔 영향 없음, 분류용 */
  downtimeThresholdMs: number;
}

const HOUR_MS = 3_600_000;

/**
 * 정렬된(시작 오름차순) 런 구간에서 가동 통계를 산출.
 * @param downtimeThresholdMs 이 값 초과 유휴는 잠재 다운타임으로 분류
 *   (기본: 4시간). 분류 전용이며 utilization 계산엔 쓰이지 않는다.
 */
export function computeEquipmentStats(
  intervals: readonly RunInterval[],
  downtimeThresholdMs = 4 * HOUR_MS,
): EquipmentStats {
  const runs = intervals.length;
  const empty: EquipmentStats = {
    runs: 0, spanMs: 0, productiveMs: 0, idleMs: 0, utilization: 0,
    meanRunMs: 0, meanIntervalMs: 0, longestGapMs: 0, longestGapAtMs: null,
    gaps: [], downtimeThresholdMs,
  };
  if (runs === 0) return empty;

  const sorted = [...intervals].sort((a, b) => a.startMs - b.startMs);
  const spanMs = sorted[runs - 1].endMs - sorted[0].startMs;

  // 런 구간이 시간상 겹칠 수 있으므로(동시/인터리브 처리) 가동시간은
  // 구간 합이 아니라 **합집합(union)** 길이로 계산한다 → 가동률 ≤ 100%.
  const merged: { startMs: number; endMs: number }[] = [];
  for (const r of sorted) {
    const last = merged[merged.length - 1];
    if (last && r.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, r.endMs);
    } else {
      merged.push({ startMs: r.startMs, endMs: Math.max(r.startMs, r.endMs) });
    }
  }
  const productiveMs = merged.reduce((s, m) => s + (m.endMs - m.startMs), 0);

  // 유휴 간격은 합쳐진 가동 블록 사이에서 계산
  const gaps: IdleGap[] = [];
  for (let i = 1; i < merged.length; i += 1) {
    const gapMs = merged[i].startMs - merged[i - 1].endMs;
    gaps.push({
      afterIndex: i - 1,
      startMs: merged[i - 1].endMs,
      gapMs,
      isDowntime: gapMs > downtimeThresholdMs,
    });
  }

  const idleMs = Math.max(0, spanMs - productiveMs);
  // 평균 처리시간은 원본 런 기준(겹침과 무관한 웨이퍼당 처리 길이)
  const meanRunMs =
    sorted.reduce((s, r) => s + Math.max(0, r.endMs - r.startMs), 0) / runs;

  const intervalStarts: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) intervalStarts.push(sorted[i].startMs - sorted[i - 1].startMs);
  const meanIntervalMs = intervalStarts.length
    ? intervalStarts.reduce((a, b) => a + b, 0) / intervalStarts.length
    : 0;

  let longestGapMs = 0;
  let longestGapAtMs: number | null = null;
  for (const g of gaps) {
    if (g.gapMs > longestGapMs) {
      longestGapMs = g.gapMs;
      longestGapAtMs = g.startMs;
    }
  }

  return {
    runs,
    spanMs,
    productiveMs,
    idleMs,
    utilization: spanMs > 0 ? productiveMs / spanMs : 0,
    meanRunMs,
    meanIntervalMs,
    longestGapMs,
    longestGapAtMs,
    gaps,
    downtimeThresholdMs,
  };
}

/** ms → 사람이 읽는 기간(d/h/m) */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0m';
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / HOUR_MS);
  const m = Math.floor((ms % HOUR_MS) / 60_000);
  return [d ? `${d}d` : '', h ? `${h}h` : '', m ? `${m}m` : ''].filter(Boolean).join(' ') || '0m';
}

/** RF 누적 가동시간(SOURCE_ON_TIME) 기반 PM 프록시 진척도 */
export interface PmProxy {
  /** 현재 누적 RF on-time(최댓값) */
  current: number;
  /** PM 임계(설정) */
  threshold: number;
  /** 진척률(0~1+) */
  ratio: number;
  /** 임계 초과 여부 */
  due: boolean;
}

/** 누적 RF on-time과 임계로 PM 프록시 산출 */
export function computePmProxy(currentOnTime: number, threshold: number): PmProxy {
  const ratio = threshold > 0 ? currentOnTime / threshold : 0;
  return { current: currentOnTime, threshold, ratio, due: ratio >= 1 };
}
