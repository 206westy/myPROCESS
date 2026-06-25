'use client';

/**
 * 컨텍스트 적응형 관리도(ECharts). 한 컨텍스트×신호의 웨이퍼 점열을
 * 중심선·UCL·LCL·σ존과 함께 그리고, 위반 점을 강조한다.
 *
 * 고주파가 아닌 "웨이퍼당 1점" 시계열이므로 점 수는 수십~수백 수준.
 * 캔버스 렌더러로 충분히 부드럽다.
 */

import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { ControlChartResult } from '@/lib/spc/types';

const COLORS = {
  line: '#3fb6c8',
  point: '#7fd6e3',
  center: '#8aa0ad',
  limit: '#d98a3a',
  alarm: '#e0564a',
  warn: '#d9b04a',
  zone1: 'rgba(63, 182, 200, 0.06)',
  zone2: 'rgba(63, 182, 200, 0.04)',
  text: '#b3c0c9',
  grid: 'rgba(120, 140, 150, 0.15)',
};

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1000 || (abs < 0.01 && abs > 0)) return n.toExponential(2);
  return n.toFixed(2);
}

export default function ControlChart({ result }: { result: ControlChartResult }) {
  const option = useMemo(() => {
    const { points, limits, violations } = result;
    const labels = points.map((p) => `${p.lot}·W${p.waferNo}`);
    const values = points.map((p) => p.value);
    const violationByIndex = new Map(violations.map((v) => [v.index, v]));

    // 위반 점만 산점 오버레이(심각도별 색)
    const alarmPts = points
      .map((p, i) => ({ value: [i, p.value], v: violationByIndex.get(i) }))
      .filter((d) => d.v?.severity === 'alarm')
      .map((d) => d.value);
    const warnPts = points
      .map((p, i) => ({ value: [i, p.value], v: violationByIndex.get(i) }))
      .filter((d) => d.v && d.v.severity === 'warn')
      .map((d) => d.value);

    const hasSigma = limits.sigma > 0;

    return {
      animationDuration: 300,
      grid: { left: 56, right: 24, top: 24, bottom: 64 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1c2329',
        borderColor: COLORS.grid,
        textStyle: { color: COLORS.text, fontSize: 12 },
        formatter: (params: { dataIndex: number }[]) => {
          const i = params[0]?.dataIndex ?? 0;
          const p = points[i];
          const v = violationByIndex.get(i);
          return [
            `<b>${p.lot} · W${p.waferNo}</b>`,
            `값: <b>${fmt(p.value)}</b>`,
            `시각: ${p.time.replace('T', ' ')}`,
            `범위: ${fmt(p.min)} ~ ${fmt(p.max)} (n=${p.samples})`,
            v ? `<span style="color:${v.severity === 'alarm' ? COLORS.alarm : COLORS.warn}">⚠ ${v.message}</span>` : '',
          ]
            .filter(Boolean)
            .join('<br/>');
        },
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { color: COLORS.text, fontSize: 10, hideOverlap: true, rotate: labels.length > 12 ? 45 : 0 },
        axisLine: { lineStyle: { color: COLORS.grid } },
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLabel: { color: COLORS.text, fontSize: 11, formatter: (v: number) => fmt(v) },
        splitLine: { lineStyle: { color: COLORS.grid } },
      },
      series: [
        {
          type: 'line',
          name: result.signal,
          data: values,
          showSymbol: true,
          symbolSize: 5,
          lineStyle: { color: COLORS.line, width: 1.5 },
          itemStyle: { color: COLORS.point },
          z: 3,
          markLine: {
            silent: true,
            symbol: 'none',
            label: { color: COLORS.text, fontSize: 10, formatter: (p: { name: string }) => p.name },
            data: hasSigma
              ? [
                  { yAxis: limits.ucl, name: `UCL ${fmt(limits.ucl)}`, lineStyle: { color: COLORS.limit, type: 'dashed' } },
                  { yAxis: limits.centerLine, name: `CL ${fmt(limits.centerLine)}`, lineStyle: { color: COLORS.center } },
                  { yAxis: limits.lcl, name: `LCL ${fmt(limits.lcl)}`, lineStyle: { color: COLORS.limit, type: 'dashed' } },
                ]
              : [{ yAxis: limits.centerLine, name: `CL ${fmt(limits.centerLine)}`, lineStyle: { color: COLORS.center } }],
          },
          markArea: hasSigma
            ? {
                silent: true,
                data: [
                  [{ yAxis: limits.zoneLower1, itemStyle: { color: COLORS.zone1 } }, { yAxis: limits.zoneUpper1 }],
                  [{ yAxis: limits.zoneUpper1, itemStyle: { color: COLORS.zone2 } }, { yAxis: limits.zoneUpper2 }],
                  [{ yAxis: limits.zoneLower2, itemStyle: { color: COLORS.zone2 } }, { yAxis: limits.zoneLower1 }],
                ],
              }
            : undefined,
        },
        {
          type: 'scatter',
          name: '경고',
          data: warnPts,
          symbolSize: 9,
          itemStyle: { color: COLORS.warn, borderColor: '#1c2329', borderWidth: 1 },
          z: 4,
        },
        {
          type: 'scatter',
          name: '위반',
          data: alarmPts,
          symbolSize: 11,
          itemStyle: { color: COLORS.alarm, borderColor: '#1c2329', borderWidth: 1 },
          z: 5,
        },
      ],
    };
  }, [result]);

  return (
    <ReactECharts
      option={option}
      style={{ height: 420, width: '100%' }}
      opts={{ renderer: 'canvas' }}
      notMerge
    />
  );
}
