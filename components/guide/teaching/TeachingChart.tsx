'use client';

/** 가이드 교육용 차트 렌더러 — ECharts option을 받아 그린다. */

import ReactECharts from 'echarts-for-react';

export default function TeachingChart({
  option,
  height = 300,
}: {
  option: Record<string, unknown>;
  height?: number;
}) {
  return (
    <ReactECharts
      option={option}
      style={{ height, width: '100%' }}
      opts={{ renderer: 'canvas' }}
      notMerge
    />
  );
}
