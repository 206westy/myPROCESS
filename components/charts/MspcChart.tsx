'use client';

/**
 * 다변량 FDC 차트(ECharts) — 웨이퍼별 Hotelling T² 와 SPE/Q 를 각각
 * 한계선과 함께 그린다. 한계 초과 점은 색으로 강조한다.
 */

import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { FdcResult } from '@/lib/fdc/service';

const C = {
  t2: '#3fb6c8',
  spe: '#c89b3f',
  limit: '#e0564a',
  text: '#b3c0c9',
  grid: 'rgba(120, 140, 150, 0.15)',
};

export default function MspcChart({ data }: { data: FdcResult & { lots?: { lot: string; waferNo: string }[] } }) {
  const option = useMemo(() => {
    const labels = data.results.map((r, i) => {
      const lot = data.lots?.[i];
      return lot ? `${lot.lot}·W${lot.waferNo}` : `#${i}`;
    });
    const t2 = data.results.map((r) => r.t2);
    const spe = data.results.map((r) => r.spe);

    return {
      animationDuration: 300,
      grid: { left: 56, right: 56, top: 30, bottom: 64 },
      legend: { data: ['T²', 'SPE'], textStyle: { color: C.text }, top: 0 },
      tooltip: { trigger: 'axis', backgroundColor: '#1c2329', borderColor: C.grid, textStyle: { color: C.text, fontSize: 12 } },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { color: C.text, fontSize: 10, hideOverlap: true, rotate: labels.length > 12 ? 45 : 0 },
        axisLine: { lineStyle: { color: C.grid } },
      },
      yAxis: [
        { type: 'value', name: 'T²', scale: true, axisLabel: { color: C.text, fontSize: 10 }, splitLine: { lineStyle: { color: C.grid } } },
        { type: 'value', name: 'SPE', scale: true, axisLabel: { color: C.text, fontSize: 10 }, splitLine: { show: false } },
      ],
      series: [
        {
          type: 'line', name: 'T²', data: t2, yAxisIndex: 0, showSymbol: true, symbolSize: 5,
          lineStyle: { color: C.t2, width: 1.5 }, itemStyle: { color: C.t2 },
          markLine: { silent: true, symbol: 'none', label: { color: C.text, fontSize: 10 },
            data: [{ yAxis: data.t2Limit, name: `T² 한계`, lineStyle: { color: C.limit, type: 'dashed' } }] },
        },
        {
          type: 'line', name: 'SPE', data: spe, yAxisIndex: 1, showSymbol: true, symbolSize: 5,
          lineStyle: { color: C.spe, width: 1.5 }, itemStyle: { color: C.spe },
          markLine: { silent: true, symbol: 'none', label: { color: C.text, fontSize: 10 },
            data: [{ yAxis: data.speLimit, name: `SPE 한계`, lineStyle: { color: C.limit, type: 'dotted' } }] },
        },
      ],
    };
  }, [data]);

  return <ReactECharts option={option} style={{ height: 420, width: '100%' }} opts={{ renderer: 'canvas' }} notMerge />;
}
