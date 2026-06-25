'use client';

/**
 * FDC 트레이스 차트(ECharts) — 한 웨이퍼 스텝의 다중 신호 오버레이.
 *
 * 신호마다 스케일이 크게 달라(압력 vs 파워 vs 온도) 그대로 겹치면
 * 형상 비교가 불가능하다. 따라서 각 신호를 [0,1]로 min-max 정규화해
 * **형상(shape)**을 비교하고, 툴팁에는 원값을 표시한다. dataZoom으로
 * 구간 확대/브러시가 가능하다.
 */

import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { TraceSeries } from '@/lib/api/types';

const SERIES_COLORS = ['#3fb6c8', '#d98a3a', '#7fb069', '#e0796b', '#b07fd4', '#d9b04a'];
const AXIS = { text: '#b3c0c9', grid: 'rgba(120,140,150,0.15)' };

function normalize(values: (number | null)[]): { norm: (number | null)[]; min: number; max: number } {
  const finite = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (finite.length === 0) return { norm: values.map(() => null), min: NaN, max: NaN };
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const span = max - min;
  const norm = values.map((v) =>
    v === null || !Number.isFinite(v) ? null : span === 0 ? 0.5 : (v - min) / span,
  );
  return { norm, min, max };
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1000 || (abs < 0.01 && abs > 0)) return n.toExponential(2);
  return n.toFixed(2);
}

interface TraceChartProps {
  trace: TraceSeries;
  signals: string[];
}

export default function TraceChart({ trace, signals }: TraceChartProps) {
  const option = useMemo(() => {
    const raw: Record<string, (number | null)[]> = {};
    const ranges: Record<string, { min: number; max: number }> = {};

    const series = signals.map((name, i) => {
      const values = trace.signals[name] ?? [];
      raw[name] = values;
      const { norm, min, max } = normalize(values);
      ranges[name] = { min, max };
      return {
        type: 'line' as const,
        name,
        data: norm,
        showSymbol: false,
        sampling: 'lttb' as const,
        lineStyle: { width: 1.3, color: SERIES_COLORS[i % SERIES_COLORS.length] },
        itemStyle: { color: SERIES_COLORS[i % SERIES_COLORS.length] },
        emphasis: { focus: 'series' as const },
      };
    });

    // 시간 라벨(HH:MM:SS만 — 날짜 제거)
    const labels = trace.time.map((t) => t.slice(11));

    return {
      animation: false,
      color: SERIES_COLORS,
      legend: { top: 0, textStyle: { color: AXIS.text, fontSize: 11 } },
      grid: { left: 16, right: 16, top: 40, bottom: 64 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1c2329',
        borderColor: AXIS.grid,
        textStyle: { color: AXIS.text, fontSize: 12 },
        formatter: (params: { dataIndex: number }[]) => {
          const idx = params[0]?.dataIndex ?? 0;
          const head = `시각 ${labels[idx] ?? ''}`;
          const lines = signals.map((name, i) => {
            const v = raw[name]?.[idx];
            const color = SERIES_COLORS[i % SERIES_COLORS.length];
            return `<span style="color:${color}">●</span> ${name}: <b>${v === null || v === undefined ? '—' : fmt(v)}</b>`;
          });
          return [head, ...lines].join('<br/>');
        },
      },
      xAxis: {
        type: 'category',
        data: labels,
        boundaryGap: false,
        axisLabel: { color: AXIS.text, fontSize: 10, hideOverlap: true },
        axisLine: { lineStyle: { color: AXIS.grid } },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 1,
        name: '정규화(형상)',
        nameTextStyle: { color: AXIS.text, fontSize: 10 },
        axisLabel: { color: AXIS.text, fontSize: 10, formatter: (v: number) => v.toFixed(1) },
        splitLine: { lineStyle: { color: AXIS.grid } },
      },
      dataZoom: [
        { type: 'inside', throttle: 50 },
        { type: 'slider', height: 18, bottom: 24, borderColor: AXIS.grid, textStyle: { color: AXIS.text } },
      ],
      series,
    };
  }, [trace, signals]);

  return (
    <ReactECharts
      option={option}
      style={{ height: 460, width: '100%' }}
      opts={{ renderer: 'canvas' }}
      notMerge
    />
  );
}
