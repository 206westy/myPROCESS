'use client';

/**
 * 벤치마크 비교 대시보드 — 합성 결함 시나리오별로 SPC 방법을 객관 비교.
 * 각 지표에 평이한 설명을 붙여 "어느 방법이 왜 나은가"를 납득시킨다.
 */

import { useEffect, useState } from 'react';
import { fetchJson } from '@/lib/api/client';
import type { BenchmarkReport, MethodId, MethodScenarioResult } from '@/lib/bench/harness';

interface BenchmarkData {
  methodLabels: Record<MethodId, string>;
  scenarios: Array<BenchmarkReport & { name: string }>;
}

function num(v: number | null, d = 2): string {
  if (v === null) return '미탐지';
  if (!Number.isFinite(v)) return '∞';
  return v.toFixed(d);
}

/** 값이 좋을수록 강조(재현율/F1 높을수록, 지연/FAR 낮을수록) */
function tone(metric: string, v: number | null): string {
  if (v === null) return 'var(--color-text-dim)';
  if (metric === 'recall' || metric === 'f1') return v >= 0.8 ? 'var(--color-ok, #4bbf73)' : v >= 0.4 ? 'var(--color-warn, #d9b04a)' : 'var(--color-alarm, #e0564a)';
  if (metric === 'far') return v <= 0.02 ? 'var(--color-ok, #4bbf73)' : v <= 0.1 ? 'var(--color-warn, #d9b04a)' : 'var(--color-alarm, #e0564a)';
  return 'inherit';
}

const HEADERS = ['방법', 'P', 'R', 'F1', '지연', 'FAR', 'ARL₀', 'ARL₁'];

function Row({ label, r }: { label: string; r: MethodScenarioResult }) {
  const m = r.metrics;
  const td: React.CSSProperties = { padding: '6px 8px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)' };
  return (
    <tr style={{ borderTop: '1px solid var(--color-border)' }}>
      <td style={{ padding: '6px 8px' }}>{label}</td>
      <td style={td}>{num(m.precision)}</td>
      <td style={{ ...td, color: tone('recall', m.recall) }}>{num(m.recall)}</td>
      <td style={{ ...td, color: tone('f1', m.f1) }}>{num(m.f1)}</td>
      <td style={td}>{num(m.detectionDelay, 0)}</td>
      <td style={{ ...td, color: tone('far', m.falseAlarmRate) }}>{num(m.falseAlarmRate)}</td>
      <td style={td}>{num(r.arl0, 0)}</td>
      <td style={td}>{num(r.arl1, 1)}</td>
    </tr>
  );
}

export default function BenchmarkTable() {
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<BenchmarkData>('/api/benchmark').then(setData).catch((e) => setError(String(e)));
  }, []);

  if (error) return <div className="card" style={{ borderColor: 'var(--color-alarm)' }}>오류: {error}</div>;
  if (!data) return <div className="empty-state">벤치마크 계산 중…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card">
        <span className="card-title">지표 설명</span>
        <p className="muted" style={{ fontSize: '0.82rem', marginTop: '0.5rem', lineHeight: 1.7 }}>
          <b>P/R/F1</b> 정밀도·재현율·F1(높을수록 정확). <b>지연</b> 결함 시작 후 첫 알람까지 점 수(낮을수록 빠름).{' '}
          <b>FAR</b> 정상 점 중 거짓 알람 비율(낮을수록 좋음). <b>ARL₀</b> 정상인데 거짓 알람까지 평균 점 수(높을수록 좋음, 3σ 이론 ≈370).{' '}
          <b>ARL₁</b> 시프트 시 탐지까지 평균 점 수(낮을수록 빠름). 합성 결함을 주입해 정답을 알기에 객관·재현 가능합니다.
        </p>
      </div>

      {data.scenarios.map((sc) => (
        <div className="card" key={sc.name}>
          <div className="card-title" style={{ marginBottom: '0.5rem' }}>{sc.name}</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ textAlign: 'right', color: 'var(--color-text-dim)' }}>
                  {HEADERS.map((h, i) => (
                    <th key={h} style={{ padding: '4px 8px', textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sc.results.map((r) => (
                  <Row key={r.method} label={data.methodLabels[r.method]} r={r} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="card">
        <span className="card-title">해석</span>
        <ul className="muted" style={{ fontSize: '0.82rem', marginTop: '0.5rem', lineHeight: 1.8, paddingLeft: '1.1rem' }}>
          <li>정적 3σ는 결함이 한계 계산을 오염시켜 거짓경보↑·재현율↓ (현행 방식의 함정).</li>
          <li>동결 I-MR은 깨끗한 베이스라인으로 거짓경보↓. 큰 시프트·스파이크 즉시 탐지.</li>
          <li>EWMA/CUSUM은 작은 지속 시프트(+1σ)를 더 빨리(지연↓) 잡음.</li>
          <li>잔차 차트는 자기상관/드리프트를 제거해 거짓경보를 억제.</li>
        </ul>
      </div>
    </div>
  );
}
