/**
 * 가이드북 교육용 차트 — ECharts 옵션 빌더 모음.
 *
 * 각 함수는 한 통계 개념을 "주석이 달린" 차트로 보여주기 위한 ECharts
 * option을 반환한다. 데이터는 실제 검증값에 기반한 큐레이션(교육 목적)이며,
 * 실제 Recipe/Lot명을 예시로 사용한다. 앱 차트 팔레트를 재사용한다.
 */

const C = {
  line: '#3fb6c8',
  point: '#7fd6e3',
  center: '#8aa0ad',
  limit: '#d98a3a',
  spec: '#b06fd6',
  alarm: '#e0564a',
  warn: '#d9b04a',
  ok: '#4fb87a',
  zone1: 'rgba(63, 182, 200, 0.07)',
  zone2: 'rgba(63, 182, 200, 0.045)',
  text: '#b3c0c9',
  dim: '#7c8b93',
  grid: 'rgba(120, 140, 150, 0.15)',
};

const base = {
  backgroundColor: 'transparent',
  textStyle: { color: C.text },
  tooltip: {
    backgroundColor: '#1c2329',
    borderColor: C.grid,
    textStyle: { color: C.text, fontSize: 12 },
  },
};

/** 1) 지표 엔진 — 한 트레이스에서 평균/기울기/오버슈트를 뽑는 그림 */
export function indicatorTraceOption() {
  // Gas2_Monitor 한 step 트레이스 형태(상승→플래토→하강), 오버슈트 존재
  const t = Array.from({ length: 40 }, (_, i) => i);
  const y = t.map((i) => {
    if (i < 6) return 20 + i * 6; // 상승(램프)
    if (i === 7) return 62.5; // 오버슈트 피크
    if (i < 34) return 53 + Math.sin(i / 2) * 1.2; // 플래토(정상상태)
    return 53 - (i - 34) * 5; // 하강
  });
  return {
    ...base,
    grid: { left: 44, right: 16, top: 30, bottom: 30 },
    xAxis: { type: 'category', data: t, axisLabel: { color: C.dim, fontSize: 9 }, axisLine: { lineStyle: { color: C.grid } }, name: '시간(샘플)', nameTextStyle: { color: C.dim, fontSize: 10 } },
    yAxis: { type: 'value', scale: true, axisLabel: { color: C.dim, fontSize: 10 }, splitLine: { lineStyle: { color: C.grid } } },
    series: [{
      type: 'line', data: y, smooth: true, showSymbol: false,
      lineStyle: { color: C.line, width: 2 }, areaStyle: { color: 'rgba(63,182,200,0.08)' },
      markLine: {
        silent: true, symbol: 'none',
        label: { color: C.text, fontSize: 10, position: 'insideEndTop' },
        data: [
          { yAxis: 53, name: '평균(mean) 53.3', lineStyle: { color: C.center, type: 'dashed' } },
        ],
      },
      markPoint: {
        symbolSize: 44,
        label: { color: '#fff', fontSize: 9 },
        data: [
          { coord: [7, 62.5], value: '오버슈트\n+9.5', itemStyle: { color: C.alarm } },
        ],
      },
    }],
  };
}

/** 2) 적응형 SPC — 관리한계(변함) vs 규격(고정) + 위반점 */
export function controlChartOption() {
  // 웨이퍼 20점: 대부분 CL 부근, 1점이 LCL 아래(위반)
  const vals = [53.4, 53.1, 52.8, 53.5, 53.2, 52.9, 53.6, 53.0, 53.3, 52.7,
    53.5, 53.1, 49.6, 53.2, 53.4, 52.8, 53.0, 53.3, 53.1, 52.9];
  const labels = vals.map((_, i) => `W${i + 1}`);
  const CL = 53.1, S = 0.8;
  const UCL = CL + 3 * S, LCL = CL - 3 * S;
  const USL = 56, LSL = 50; // 규격(엔지니어링) — 관리한계와 별개
  return {
    ...base,
    grid: { left: 48, right: 60, top: 20, bottom: 40 },
    tooltip: { ...base.tooltip, trigger: 'axis' },
    xAxis: { type: 'category', data: labels, axisLabel: { color: C.dim, fontSize: 9 }, axisLine: { lineStyle: { color: C.grid } } },
    yAxis: { type: 'value', scale: true, axisLabel: { color: C.dim, fontSize: 10 }, splitLine: { lineStyle: { color: C.grid } } },
    series: [{
      type: 'line', data: vals, showSymbol: true, symbolSize: 6,
      lineStyle: { color: C.line, width: 1.5 }, itemStyle: { color: C.point },
      markLine: {
        silent: true, symbol: 'none', label: { color: C.text, fontSize: 9, position: 'end' },
        data: [
          { yAxis: UCL, name: `UCL ${UCL.toFixed(1)}`, lineStyle: { color: C.limit, type: 'dashed' } },
          { yAxis: CL, name: `CL ${CL.toFixed(1)}`, lineStyle: { color: C.center } },
          { yAxis: LCL, name: `LCL ${LCL.toFixed(1)}`, lineStyle: { color: C.limit, type: 'dashed' } },
          { yAxis: USL, name: `USL ${USL} (규격)`, lineStyle: { color: C.spec, type: 'dotted', width: 1.5 } },
          { yAxis: LSL, name: `LSL ${LSL} (규격)`, lineStyle: { color: C.spec, type: 'dotted', width: 1.5 } },
        ],
      },
      markArea: {
        silent: true,
        data: [
          [{ yAxis: CL - S, itemStyle: { color: C.zone1 } }, { yAxis: CL + S }],
          [{ yAxis: CL + S, itemStyle: { color: C.zone2 } }, { yAxis: CL + 2 * S }],
          [{ yAxis: CL - 2 * S, itemStyle: { color: C.zone2 } }, { yAxis: CL - S }],
        ],
      },
    }, {
      type: 'scatter', data: [[12, 49.6]], symbolSize: 13,
      itemStyle: { color: C.alarm, borderColor: '#1c2329', borderWidth: 1 }, z: 5,
      markPoint: { symbolSize: 46, label: { color: '#fff', fontSize: 9 }, data: [{ coord: [12, 49.6], value: 'WE룰1\n3σ 밖', itemStyle: { color: C.alarm } }] },
    }],
  };
}

/** 3) EWMA — 각자 "자기 한계"로 비교: 작은 시프트를 원값보다 먼저 잡는다.
 *  핵심: EWMA는 평활되므로 σ_EWMA = σ·√(λ/(2−λ)) 로 한계가 훨씬 좁다.
 *  같은 한계에 대면 오히려 늦게 넘으므로, 원값은 넓은 3σ, EWMA는 좁은 한계에 댄다. */
export function ewmaOption() {
  // W1~6 기준선(평균 0, σ≈0.3), W7부터 작은 시프트(평균 ~0.48).
  // σ≈0.3이면 원값 3σ≈0.9, EWMA 3σ≈0.3 (σ_EWMA=σ·√(0.25/1.75)≈0.11) — 상호 일관.
  const raw = [0.3, -0.28, 0.25, -0.3, 0.32, -0.22, 0.5, 0.38, 0.58, 0.42, 0.55, 0.48, 0.6, 0.5, 0.55];
  const lambda = 0.25;
  const ewma: number[] = [];
  let z = 0;
  for (const x of raw) { z = lambda * x + (1 - lambda) * z; ewma.push(z); }
  const labels = raw.map((_, i) => `W${i + 1}`);
  const RAW_UCL = 0.9;    // 원값 개별값 3σ(넓음)
  const EWMA_UCL = 0.3;   // EWMA 한계(좁음)
  // EWMA가 자기 한계를 처음 넘는 지점
  const cross = ewma.findIndex((v) => v > EWMA_UCL);
  return {
    ...base,
    grid: { left: 40, right: 70, top: 30, bottom: 30 },
    legend: { data: ['원값', 'EWMA'], textStyle: { color: C.dim, fontSize: 10 }, top: 0, right: 0 },
    tooltip: { ...base.tooltip, trigger: 'axis' },
    xAxis: { type: 'category', data: labels, axisLabel: { color: C.dim, fontSize: 9 }, axisLine: { lineStyle: { color: C.grid } } },
    yAxis: { type: 'value', axisLabel: { color: C.dim, fontSize: 10 }, splitLine: { lineStyle: { color: C.grid } } },
    series: [
      { name: '원값', type: 'line', data: raw, showSymbol: false, lineStyle: { color: C.dim, width: 1, type: 'dashed' },
        markLine: { silent: true, symbol: 'none', label: { color: C.dim, fontSize: 9, position: 'end' },
          data: [{ yAxis: RAW_UCL, name: `원값 3σ ${RAW_UCL.toFixed(1)}`, lineStyle: { color: C.dim, type: 'dashed' } }] } },
      { name: 'EWMA', type: 'line', data: ewma, showSymbol: true, symbolSize: 5, lineStyle: { color: C.line, width: 2 }, itemStyle: { color: C.point },
        markLine: { silent: true, symbol: 'none', label: { color: C.text, fontSize: 9, position: 'end' },
          data: [{ yAxis: EWMA_UCL, name: `EWMA 한계 ${EWMA_UCL}`, lineStyle: { color: C.limit, type: 'dashed' } }] },
        markPoint: cross >= 0 ? { symbolSize: 46, label: { color: '#fff', fontSize: 9 },
          data: [{ coord: [cross, ewma[cross]], value: `조기경보\nW${cross + 1}`, itemStyle: { color: C.alarm } }] } : undefined },
    ],
  };
}

/** 4) 다변량 PCA — 2축 압축 + T²(중심에서 멀리) vs SPE(패턴 이탈) */
export function pcaOption() {
  // 정상 군집(타원형) + T² 이상(같은 방향 멀리) + SPE 이상(축 밖)
  const normal: number[][] = [];
  for (let i = 0; i < 60; i++) {
    const a = (i * 137.5 * Math.PI) / 180;
    const r = 1 + (i % 7) * 0.12;
    normal.push([Math.cos(a) * r * 1.6, Math.sin(a) * r * 0.9]);
  }
  return {
    ...base,
    grid: { left: 40, right: 16, top: 20, bottom: 34 },
    xAxis: { type: 'value', name: '주성분1(PC1)', nameTextStyle: { color: C.dim, fontSize: 10 }, axisLabel: { color: C.dim, fontSize: 9 }, splitLine: { lineStyle: { color: C.grid } }, axisLine: { lineStyle: { color: C.grid } } },
    yAxis: { type: 'value', name: 'PC2', nameTextStyle: { color: C.dim, fontSize: 10 }, axisLabel: { color: C.dim, fontSize: 9 }, splitLine: { lineStyle: { color: C.grid } } },
    series: [
      { type: 'scatter', data: normal, symbolSize: 7, itemStyle: { color: 'rgba(127,214,227,0.6)' }, name: '정상' },
      { type: 'scatter', data: [[6.5, 0.3]], symbolSize: 15, itemStyle: { color: C.warn },
        markPoint: { symbolSize: 40, label: { color: '#111', fontSize: 9 }, data: [{ coord: [6.5, 0.3], value: 'T² 높음\n(멀리)', itemStyle: { color: C.warn } }] } },
      { type: 'scatter', data: [[0.2, 4.2]], symbolSize: 15, itemStyle: { color: C.alarm },
        markPoint: { symbolSize: 40, label: { color: '#fff', fontSize: 9 }, data: [{ coord: [0.2, 4.2], value: 'SPE 높음\n(패턴이탈)', itemStyle: { color: C.alarm } }] } },
    ],
  };
}

/** 5) Commonality — 차원값별 ratio-gap 가로 막대 */
export function commonalityOption() {
  const rows = [
    { name: 'step = 7', gap: 11, sig: true },
    { name: '챔버 = HS.Good,SA.Good', gap: 10, sig: false },
    { name: 'lot = Bare', gap: 5, sig: true },
    { name: 'recipe = 50%H2N2_BKM_60s', gap: 4, sig: true },
    { name: 'stage = PM2 Stage1', gap: 5, sig: false },
  ].reverse();
  return {
    ...base,
    grid: { left: 150, right: 40, top: 12, bottom: 28 },
    tooltip: { ...base.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'value', name: 'ratio-gap(%)', nameTextStyle: { color: C.dim, fontSize: 10 }, axisLabel: { color: C.dim, fontSize: 9, formatter: '+{value}%' }, splitLine: { lineStyle: { color: C.grid } } },
    yAxis: { type: 'category', data: rows.map((r) => r.name), axisLabel: { color: C.text, fontSize: 10 }, axisLine: { lineStyle: { color: C.grid } } },
    series: [{
      type: 'bar', data: rows.map((r) => ({ value: r.gap, itemStyle: { color: r.sig ? C.alarm : C.warn } })),
      barWidth: '55%',
      label: { show: true, position: 'right', color: C.text, fontSize: 9, formatter: '+{c}%' },
    }],
  };
}

/** 6) 수율 연결 — 산점도 + 상관 r (예시: 가상 데이터) */
export function yieldScatterOption() {
  // overshoot이 클수록 수율↓ 인 예시(음의 상관 r≈-0.8)
  const pts: number[][] = [];
  const xs = [2, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
  const noise = [1.2, -0.8, 0.5, -1.1, 0.9, -0.3, 0.7, -0.9, 0.4, -0.6, 0.8, -0.4, 0.3, -0.7, 0.5, -0.5];
  xs.forEach((x, i) => pts.push([x, 99 - x * 0.9 + noise[i]]));
  return {
    ...base,
    grid: { left: 44, right: 16, top: 16, bottom: 36 },
    tooltip: { ...base.tooltip, trigger: 'item' },
    xAxis: { type: 'value', name: 'overshoot(지표)', nameTextStyle: { color: C.dim, fontSize: 10 }, axisLabel: { color: C.dim, fontSize: 9 }, splitLine: { lineStyle: { color: C.grid } } },
    yAxis: { type: 'value', scale: true, name: '수율(%)', nameTextStyle: { color: C.dim, fontSize: 10 }, axisLabel: { color: C.dim, fontSize: 9 }, splitLine: { lineStyle: { color: C.grid } } },
    series: [
      { type: 'scatter', data: pts, symbolSize: 8, itemStyle: { color: C.point } },
      { type: 'line', data: [[2, 97.2], [10, 90]], showSymbol: false, lineStyle: { color: C.limit, width: 2, type: 'dashed' }, tooltip: { show: false } },
    ],
  };
}

/** 7) 장비관리 — 가동/유휴 시간 막대 + 가동률 */
export function equipmentOption() {
  return {
    ...base,
    grid: { left: 60, right: 40, top: 12, bottom: 28 },
    tooltip: { ...base.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'value', name: '일(day)', nameTextStyle: { color: C.dim, fontSize: 10 }, axisLabel: { color: C.dim, fontSize: 9 }, splitLine: { lineStyle: { color: C.grid } } },
    yAxis: { type: 'category', data: ['전체 구간', '가동(union)', '유휴'], axisLabel: { color: C.text, fontSize: 10 }, axisLine: { lineStyle: { color: C.grid } } },
    series: [{
      type: 'bar', barWidth: '55%',
      data: [
        { value: 7.3, itemStyle: { color: C.dim } },
        { value: 3.5, itemStyle: { color: C.ok } },
        { value: 3.8, itemStyle: { color: C.warn } },
      ],
      label: { show: true, position: 'right', color: C.text, fontSize: 9, formatter: '{c}d' },
    }],
  };
}

/** 9) PCA vs PLS — 분산 최대 방향(PC1) ≠ 합격/불합격 가르는 방향(PLS) */
export function pcaVsPlsOption() {
  const rot = Math.PI / 4; // 45° 회전(주 분산축을 대각선으로)
  const cs = Math.cos(rot), sn = Math.sin(rot);
  const pass: number[][] = [];
  const fail: number[][] = [];
  for (let i = 0; i < 22; i++) {
    const u = -3 + (i / 21) * 6;               // 주 분산축(길게 퍼짐)
    const j = ((i * 7) % 5 - 2) * 0.13;         // 결정적 지터
    // 클래스는 '수직 방향(v)'으로만 갈림 → PC1(u)로는 안 갈림
    const vp = -0.7 + j, vf = 0.7 + j;
    pass.push([u * cs - vp * sn, u * sn + vp * cs]);
    fail.push([u * cs - vf * sn, u * sn + vf * cs]);
  }
  const axis = (u: number, v: number) => [u * cs - v * sn, u * sn + v * cs];
  return {
    ...base,
    grid: { left: 30, right: 20, top: 30, bottom: 24 },
    legend: { data: ['합격', '불합격'], textStyle: { color: C.dim, fontSize: 10 }, top: 0 },
    tooltip: { ...base.tooltip, trigger: 'item' },
    xAxis: { type: 'value', min: -4, max: 4, axisLabel: { show: false }, splitLine: { lineStyle: { color: C.grid } }, axisLine: { lineStyle: { color: C.grid } } },
    yAxis: { type: 'value', min: -4, max: 4, axisLabel: { show: false }, splitLine: { lineStyle: { color: C.grid } } },
    series: [
      { name: '합격', type: 'scatter', data: pass, symbolSize: 8, itemStyle: { color: C.ok } },
      { name: '불합격', type: 'scatter', data: fail, symbolSize: 8, itemStyle: { color: C.alarm } },
      // PC1: 분산이 가장 큰 방향(회색) — 두 클래스를 못 가름
      { type: 'line', data: [axis(-3.4, 0), axis(3.4, 0)], showSymbol: true, symbol: 'arrow', symbolSize: 10, lineStyle: { color: C.dim, width: 2 }, tooltip: { show: false },
        markPoint: { symbolSize: 1, label: { color: C.dim, fontSize: 10 }, data: [{ coord: axis(3.4, 0), value: 'PC1 (분산 최대)' }] } },
      // PLS: 합격/불합격을 가르는 방향(보라) — 분산은 작지만 결과를 가름
      { type: 'line', data: [axis(0, -1.3), axis(0, 1.3)], showSymbol: true, symbol: 'arrow', symbolSize: 10, lineStyle: { color: C.spec, width: 2.5 }, tooltip: { show: false },
        markPoint: { symbolSize: 1, label: { color: C.spec, fontSize: 10 }, data: [{ coord: axis(0, 1.6), value: 'PLS (P/F 분리)' }] } },
    ],
  };
}

/** 10) 누적분포(ECDF) — 베이스라인 vs 현재: 시프트+꼬리 변화와 K-S 최대격차 */
export function ecdfOption() {
  const baseVals = [51.2, 51.8, 52.0, 52.3, 52.5, 52.6, 52.8, 52.9, 53.0, 53.0, 53.1, 53.2, 53.2, 53.3, 53.4, 53.5, 53.6, 53.7, 53.8, 54.0, 54.2, 54.4, 54.6, 55.0, 55.4];
  const curVals = [51.8, 52.4, 52.8, 53.0, 53.3, 53.5, 53.7, 53.9, 54.0, 54.1, 54.2, 54.4, 54.5, 54.6, 54.8, 55.0, 55.2, 55.5, 55.8, 56.2, 56.6, 57.0, 57.6, 58.2, 59.0];
  const ecdf = (vals: number[]) => {
    const s = [...vals].sort((a, b) => a - b);
    return s.map((x, i) => [x, (i + 1) / s.length]);
  };
  const Fbase = ecdf(baseVals), Fcur = ecdf(curVals);
  // K-S: 두 ECDF 최대 세로 격차 위치 찾기
  const at = (F: number[][], x: number) => {
    let y = 0;
    for (const [xi, yi] of F) { if (xi <= x) y = yi; else break; }
    return y;
  };
  const xs = [...baseVals, ...curVals].sort((a, b) => a - b);
  let D = 0, Dx = xs[0];
  for (const x of xs) { const d = Math.abs(at(Fbase, x) - at(Fcur, x)); if (d > D) { D = d; Dx = x; } }
  return {
    ...base,
    grid: { left: 44, right: 16, top: 30, bottom: 30 },
    legend: { data: ['베이스라인(동결)', '현재'], textStyle: { color: C.dim, fontSize: 10 }, top: 0 },
    tooltip: { ...base.tooltip, trigger: 'axis' },
    xAxis: { type: 'value', scale: true, name: '지표값', nameTextStyle: { color: C.dim, fontSize: 10 }, axisLabel: { color: C.dim, fontSize: 9 }, splitLine: { lineStyle: { color: C.grid } } },
    yAxis: { type: 'value', min: 0, max: 1, name: '누적비율', nameTextStyle: { color: C.dim, fontSize: 10 }, axisLabel: { color: C.dim, fontSize: 9 }, splitLine: { lineStyle: { color: C.grid } } },
    series: [
      { name: '베이스라인(동결)', type: 'line', step: 'end', data: Fbase, showSymbol: false, lineStyle: { color: C.center, width: 2 } },
      { name: '현재', type: 'line', step: 'end', data: Fcur, showSymbol: false, lineStyle: { color: C.line, width: 2 },
        markLine: { silent: true, symbol: 'none', label: { color: C.alarm, fontSize: 9, formatter: `K-S D=${D.toFixed(2)}` },
          data: [{ xAxis: Dx, lineStyle: { color: C.alarm, type: 'dashed' } }] } },
    ],
  };
}

/** 8) 벤치마크 — 방법별 재현율/정밀도(작은 시프트) */
export function benchmarkOption() {
  const methods = ['정적 3σ', 'EWMA', 'CUSUM'];
  return {
    ...base,
    grid: { left: 44, right: 16, top: 24, bottom: 28 },
    legend: { data: ['재현율', '정밀도'], textStyle: { color: C.dim, fontSize: 10 }, top: 0 },
    tooltip: { ...base.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'category', data: methods, axisLabel: { color: C.text, fontSize: 10 }, axisLine: { lineStyle: { color: C.grid } } },
    yAxis: { type: 'value', max: 1, name: '점수', nameTextStyle: { color: C.dim, fontSize: 10 }, axisLabel: { color: C.dim, fontSize: 9 }, splitLine: { lineStyle: { color: C.grid } } },
    series: [
      { name: '재현율', type: 'bar', data: [0.35, 0.82, 0.88], itemStyle: { color: C.line }, barGap: 0.1 },
      { name: '정밀도', type: 'bar', data: [0.9, 0.8, 0.78], itemStyle: { color: C.warn } },
    ],
  };
}
