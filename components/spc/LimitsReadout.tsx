'use client';

/** 관리한계 요약 readout — 운영 질문 "정상인가?"에 답하는 KPI 묶음 */

import type { ControlChartResult } from '@/lib/spc/types';

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1000 || (abs < 0.01 && abs > 0)) return n.toExponential(2);
  return n.toFixed(3);
}

export default function LimitsReadout({ result }: { result: ControlChartResult }) {
  const { limits, violations, points } = result;
  const alarms = violations.filter((v) => v.severity === 'alarm').length;
  const warns = violations.filter((v) => v.severity === 'warn').length;

  const status =
    alarms > 0 ? { cls: 'badge-alarm', text: `위반 ${alarms}` }
    : warns > 0 ? { cls: 'badge-warn', text: `경고 ${warns}` }
    : { cls: 'badge-ok', text: '관리상태' };

  const items: { label: string; value: string }[] = [
    { label: 'UCL (+3σ)', value: fmt(limits.ucl) },
    { label: '중심선 CL', value: fmt(limits.centerLine) },
    { label: 'LCL (−3σ)', value: fmt(limits.lcl) },
    { label: 'σ (MR기반)', value: fmt(limits.sigma) },
    { label: '웨이퍼 점수', value: String(points.length) },
  ];

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <span className="card-title">관리한계 (컨텍스트 적응형)</span>
        <span className={`badge ${status.cls}`}>{status.text}</span>
      </div>
      <div className="kpi-grid">
        {items.map((it) => (
          <div key={it.label}>
            <div className="field-label">{it.label}</div>
            <div className="kpi-value" style={{ fontSize: '1.4rem' }}>{it.value}</div>
          </div>
        ))}
      </div>
      {limits.insufficient && (
        <p className="muted" style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}>
          ⚠ 점이 {points.length}개로 적어 한계가 통계적으로 불안정할 수 있습니다(권장 8개 이상).
        </p>
      )}
    </div>
  );
}
