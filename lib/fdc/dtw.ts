/**
 * DTW(동적 시간 워핑) — 순수 함수.
 *
 * 두 트레이스(길이 다를 수 있음)를 시간축으로 신축 정렬해 형태 유사도를
 * 잰다. 반도체 트레이스는 스텝 길이가 웨이퍼마다 조금씩 다르므로, 단순
 * 점대점 비교 대신 DTW로 정렬 후 거리를 본다(드리프트 적응 FDC의 기반).
 *
 * Sakoe-Chiba 밴드로 워핑 폭을 제한해 계산량과 과도 신축을 막는다.
 */

export interface DtwResult {
  /** 정렬 누적 거리 */
  distance: number;
  /** 경로 길이로 정규화한 평균 거리(트레이스 길이 무관 비교용) */
  normalizedDistance: number;
  /** 정렬 경로 [(i,j), ...] */
  path: Array<[number, number]>;
}

/**
 * DTW 거리. band: Sakoe-Chiba 반경(인덱스 차 허용폭). 0이면 무제한.
 */
export function dtw(a: readonly number[], b: readonly number[], band = 0): DtwResult {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) {
    return { distance: Infinity, normalizedDistance: Infinity, path: [] };
  }
  const w = band > 0 ? Math.max(band, Math.abs(n - m)) : Math.max(n, m);
  const INF = Number.POSITIVE_INFINITY;
  const D: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(INF));
  D[0][0] = 0;

  for (let i = 1; i <= n; i += 1) {
    const jStart = Math.max(1, i - w);
    const jEnd = Math.min(m, i + w);
    for (let j = jStart; j <= jEnd; j += 1) {
      const cost = Math.abs(a[i - 1] - b[j - 1]);
      const best = Math.min(D[i - 1][j], D[i][j - 1], D[i - 1][j - 1]);
      D[i][j] = cost + best;
    }
  }

  // 경로 역추적
  const path: Array<[number, number]> = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    path.push([i - 1, j - 1]);
    const diag = D[i - 1][j - 1];
    const up = D[i - 1][j];
    const left = D[i][j - 1];
    const min = Math.min(diag, up, left);
    if (min === diag) {
      i -= 1;
      j -= 1;
    } else if (min === up) {
      i -= 1;
    } else {
      j -= 1;
    }
  }
  path.reverse();

  const distance = D[n][m];
  return {
    distance,
    normalizedDistance: path.length ? distance / path.length : Infinity,
    path,
  };
}
