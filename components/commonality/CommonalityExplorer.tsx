'use client';

/**
 * Commonality 탐색기 — 신호×지표의 컨텍스트 내 이상치 집합을 만든 뒤,
 * 어떤 차원값이 이상 집합에 과대표집됐는지(ratio-gap) 막대로 순위화한다.
 * (Honeycomb BubbleUp식 인터랙션 — 수율 데이터 없이 트레이스만으로)
 */

import { useEffect, useMemo, useState } from 'react';
import { fetchJson } from '@/lib/api/client';
import type { ContextMeta, SignalStat, CommonalityReportDto } from '@/lib/api/types';
import { signalsBySubsystem } from '@/lib/csv/signals';
import { CHARTABLE_INDICATORS } from '@/lib/indicators/catalog';

const DIM_LABEL: Record<string, string> = {
  recipe: 'Recipe',
  stage: 'Stage',
  step: 'Step',
  chamber: '챔버(System Label)',
  lot: 'Lot',
  date: '날짜',
};

export default function CommonalityExplorer() {
  const [meta, setMeta] = useState<ContextMeta | null>(null);
  const [signal, setSignal] = useState('');
  const [indicator, setIndicator] = useState('mean');
  const [recipe, setRecipe] = useState('');
  const [k, setK] = useState(3.5);
  const [report, setReport] = useState<CommonalityReportDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchJson<ContextMeta>('/api/context').then(setMeta).catch((e) => setError(String(e)));
  }, []);

  const analogSet = useMemo(() => {
    const m = new Map<string, SignalStat>();
    meta?.signals.forEach((s) => {
      if (!s.isFlag && s.nonNull > 0) m.set(s.signal, s);
    });
    return m;
  }, [meta]);

  const signalGroups = useMemo(
    () =>
      signalsBySubsystem()
        .map((g) => ({ ...g, signals: g.signals.filter((s) => analogSet.has(s.name)) }))
        .filter((g) => g.signals.length > 0),
    [analogSet],
  );

  const recipes = useMemo(
    () => [...new Set(meta?.contexts.map((c) => c.recipe) ?? [])].sort(),
    [meta],
  );

  useEffect(() => {
    if (!signal) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ signal, indicator, k: String(k) });
    if (recipe) params.set('recipe', recipe);
    fetchJson<CommonalityReportDto>(`/api/commonality?${params}`)
      .then(setReport)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [signal, indicator, recipe, k]);

  const topFindings = useMemo(
    () => (report?.findings ?? []).filter((f) => f.ratioGap > 0).slice(0, 15),
    [report],
  );
  const maxGap = useMemo(
    () => Math.max(0.0001, ...topFindings.map((f) => f.ratioGap)),
    [topFindings],
  );

  return (
    <>
      <div className="toolbar">
        <label className="field">
          <span className="field-label">신호 (아날로그)</span>
          <select value={signal} onChange={(e) => setSignal(e.target.value)}>
            <option value="">선택…</option>
            {signalGroups.map((g) => (
              <optgroup key={g.subsystem.key} label={g.subsystem.label}>
                {g.signals.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">지표</span>
          <select value={indicator} onChange={(e) => setIndicator(e.target.value)}>
            {CHARTABLE_INDICATORS.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">범위 Recipe (선택)</span>
          <select value={recipe} onChange={(e) => setRecipe(e.target.value)}>
            <option value="">전체</option>
            {recipes.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">이상 임계 (robust z): {k.toFixed(1)}</span>
          <input
            className="control"
            type="range"
            min={2}
            max={6}
            step={0.5}
            value={k}
            onChange={(e) => setK(Number(e.target.value))}
          />
        </label>
      </div>

      {error && <div className="card" style={{ borderColor: 'var(--color-alarm)' }}>오류: {error}</div>}
      {!report && !error && <div className="empty-state">신호를 선택하면 이상 집합 commonality가 표시됩니다.</div>}

      {report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', opacity: loading ? 0.5 : 1, transition: 'opacity 150ms' }}>
          <section className="kpi-grid">
            <div className="card"><div className="card-title">분석 웨이퍼-step</div><div className="kpi-value">{report.totalRows}</div></div>
            <div className="card"><div className="card-title">이상(anomaly)</div><div className="kpi-value" style={{ color: 'var(--color-alarm)' }}>{report.badRows}</div></div>
            <div className="card"><div className="card-title">정상</div><div className="kpi-value">{report.goodRows}</div></div>
            <div className="card"><div className="card-title">이상 비율</div><div className="kpi-value">{report.totalRows ? ((100 * report.badRows) / report.totalRows).toFixed(1) : '0'}<span className="kpi-unit">%</span></div></div>
          </section>

          <section className="card">
            <div className="card-title" style={{ marginBottom: '0.75rem' }}>
              과대표집 차원 순위 (ratio-gap = 이상비율 − 정상비율)
            </div>
            {report.badRows === 0 ? (
              <div className="empty-state">임계 z={report.k} 에서 이상 웨이퍼가 없습니다. 임계를 낮춰보세요.</div>
            ) : topFindings.length === 0 ? (
              <div className="empty-state">과대표집된 차원값이 없습니다(이상이 고르게 분포).</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--color-text-dim)' }}>
                    <th style={{ padding: '4px 8px' }}>차원 / 값</th>
                    <th style={{ padding: '4px 8px' }}>이상/정상</th>
                    <th style={{ padding: '4px 8px', width: '40%' }}>ratio-gap</th>
                    <th style={{ padding: '4px 8px' }}>유의</th>
                  </tr>
                </thead>
                <tbody>
                  {topFindings.map((f, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '6px 8px' }}>
                        <span className="muted" style={{ fontSize: '0.72rem' }}>{DIM_LABEL[f.dimension] ?? f.dimension}</span>
                        <div className="mono">{f.value}</div>
                      </td>
                      <td style={{ padding: '6px 8px' }} className="mono">
                        <span style={{ color: 'var(--color-alarm)' }}>{f.badCount}</span> / {f.goodCount}
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ flex: 1, height: 8, background: 'var(--color-surface-2)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${(100 * f.ratioGap) / maxGap}%`, height: '100%', background: f.significant ? 'var(--color-alarm)' : 'var(--color-warn)' }} />
                          </div>
                          <span className="mono" style={{ fontSize: '0.72rem', minWidth: 48, textAlign: 'right' }}>
                            +{(100 * f.ratioGap).toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        {f.significant
                          ? <span className="badge badge-alarm">z={f.z.toFixed(1)}</span>
                          : <span className="muted mono" style={{ fontSize: '0.72rem' }}>z={f.z.toFixed(1)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {report.anomalies.length > 0 && (
            <section className="card">
              <div className="card-title" style={{ marginBottom: '0.75rem' }}>이상 웨이퍼-step (|z| 상위 {report.anomalies.length})</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--color-text-dim)' }}>
                    <th style={{ padding: '4px 8px' }}>Lot · Wafer</th>
                    <th style={{ padding: '4px 8px' }}>컨텍스트</th>
                    <th style={{ padding: '4px 8px' }}>챔버</th>
                    <th style={{ padding: '4px 8px' }}>값</th>
                    <th style={{ padding: '4px 8px' }}>z</th>
                  </tr>
                </thead>
                <tbody>
                  {report.anomalies.slice(0, 20).map((a, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '6px 8px' }} className="mono">{a.lot} · W{a.waferNo}</td>
                      <td style={{ padding: '6px 8px' }}>
                        <span className="muted" style={{ fontSize: '0.72rem' }}>{a.recipe} / {a.stage} / Step {a.step}</span>
                      </td>
                      <td style={{ padding: '6px 8px' }} className="mono">{a.chamber}</td>
                      <td style={{ padding: '6px 8px' }} className="mono">{a.value.toFixed(3)}</td>
                      <td style={{ padding: '6px 8px' }}>
                        <span className="badge badge-alarm">{a.robustZ > 0 ? '+' : ''}{a.robustZ.toFixed(1)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>
      )}
    </>
  );
}
