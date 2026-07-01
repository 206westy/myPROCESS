'use client';

/**
 * 수율 연결 — 지표↔수율 Pearson 상관 순위.
 * 수율 데이터(wafer_quality)가 없으면 적재 안내를 보여준다(우아한 비활성).
 */

import { useEffect, useMemo, useState } from 'react';
import { fetchJson } from '@/lib/api/client';
import type { ContextMeta } from '@/lib/api/types';
import { CHARTABLE_INDICATORS } from '@/lib/indicators/catalog';

interface YieldResponse {
  hasData: boolean;
  correlations: { signal: string; r: number; n: number }[];
}

const RESPONSES = [
  { db: 'yield_pct', label: '수율(%)' },
  { db: 'defect_count', label: '결함 수' },
];

export default function YieldBridge() {
  const [meta, setMeta] = useState<ContextMeta | null>(null);
  const [hasData, setHasData] = useState<boolean | null>(null);
  const [recipe, setRecipe] = useState('');
  const [stage, setStage] = useState('');
  const [step, setStep] = useState<number | null>(null);
  const [indicator, setIndicator] = useState('mean');
  const [response, setResponse] = useState('yield_pct');
  const [corr, setCorr] = useState<YieldResponse['correlations']>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetchJson<ContextMeta>('/api/context'),
      fetchJson<YieldResponse>('/api/yield'),
    ])
      .then(([m, y]) => { setMeta(m); setHasData(y.hasData); })
      .catch((e) => setError(String(e)));
  }, []);

  const recipes = useMemo(() => [...new Set(meta?.contexts.map((c) => c.recipe) ?? [])].sort(), [meta]);
  const stages = useMemo(
    () => [...new Set(meta?.contexts.filter((c) => c.recipe === recipe).map((c) => c.stage) ?? [])].sort(),
    [meta, recipe],
  );
  const steps = useMemo(
    () => meta?.contexts.filter((c) => c.recipe === recipe && c.stage === stage).map((c) => c.recipeStepNum).sort((a, b) => a - b) ?? [],
    [meta, recipe, stage],
  );

  useEffect(() => {
    if (!hasData || !recipe || !stage || step === null) return;
    const params = new URLSearchParams({ recipe, stage, step: String(step), indicator, response });
    fetchJson<YieldResponse>(`/api/yield?${params}`)
      .then((y) => setCorr(y.correlations))
      .catch((e) => setError(String(e)));
  }, [hasData, recipe, stage, step, indicator, response]);

  if (error) return <div className="card" style={{ borderColor: 'var(--color-alarm)' }}>오류: {error}</div>;
  if (hasData === null) return <div className="empty-state">로딩 중…</div>;

  if (!hasData) {
    return (
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div className="card-title">수율 데이터 미연결</div>
        <p className="muted" style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
          현재 데이터셋은 설비 트레이스뿐입니다. 수율/품질 데이터를 연결하면
          <strong> 지표 ↔ 수율 상관</strong>이 자동 활성화됩니다 — 조인 키는 지표 테이블과
          동일한 <span className="mono">(lot, wafer_no)</span>입니다.
        </p>
        <div className="card" style={{ background: 'var(--color-surface-2)', fontSize: '0.8rem' }}>
          <div className="mono" style={{ marginBottom: '0.5rem' }}># 1) CSV 준비 (data/quality.csv)</div>
          <div className="mono muted">lot,wafer_no,yield_pct,defect_count,bin</div>
          <div className="mono muted">LOT123,1,98.2,5,1</div>
          <div className="mono" style={{ margin: '0.75rem 0 0.5rem' }}># 2) 적재</div>
          <div className="mono muted">pnpm load:quality</div>
        </div>
        <p className="muted" style={{ fontSize: '0.78rem' }}>
          헤더는 유연 매핑됩니다(yield/yield_pct/cp_yield, wafer/slot/wafer_no 등).
        </p>
      </div>
    );
  }

  const maxAbs = Math.max(0.0001, ...corr.map((c) => Math.abs(c.r)));

  return (
    <>
      <div className="toolbar">
        <label className="field">
          <span className="field-label">Recipe</span>
          <select value={recipe} onChange={(e) => { setRecipe(e.target.value); setStage(''); setStep(null); }}>
            <option value="">선택…</option>
            {recipes.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Stage</span>
          <select value={stage} onChange={(e) => { setStage(e.target.value); setStep(null); }} disabled={!recipe}>
            <option value="">선택…</option>
            {stages.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Step</span>
          <select value={step ?? ''} onChange={(e) => setStep(Number(e.target.value))} disabled={!stage}>
            <option value="">선택…</option>
            {steps.map((s) => <option key={s} value={s}>Step {s}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">지표</span>
          <select value={indicator} onChange={(e) => setIndicator(e.target.value)}>
            {CHARTABLE_INDICATORS.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">수율 응답</span>
          <select value={response} onChange={(e) => setResponse(e.target.value)}>
            {RESPONSES.map((r) => <option key={r.db} value={r.db}>{r.label}</option>)}
          </select>
        </label>
      </div>

      {corr.length === 0 ? (
        <div className="empty-state">컨텍스트를 선택하면 지표↔수율 상관 순위가 표시됩니다.</div>
      ) : (
        <section className="card">
          <div className="card-title" style={{ marginBottom: '0.75rem' }}>신호별 Pearson 상관 (|r| 순)</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--color-text-dim)' }}>
                <th style={{ padding: '4px 8px' }}>신호</th>
                <th style={{ padding: '4px 8px', width: '45%' }}>상관 r</th>
                <th style={{ padding: '4px 8px' }}>n</th>
              </tr>
            </thead>
            <tbody>
              {corr.slice(0, 20).map((c) => (
                <tr key={c.signal} style={{ borderTop: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '6px 8px' }} className="mono">{c.signal}</td>
                  <td style={{ padding: '6px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ flex: 1, height: 8, background: 'var(--color-surface-2)', borderRadius: 4 }}>
                        <div style={{ width: `${(100 * Math.abs(c.r)) / maxAbs}%`, height: '100%', background: c.r < 0 ? 'var(--color-warn)' : 'var(--color-accent)', borderRadius: 4 }} />
                      </div>
                      <span className="mono" style={{ minWidth: 52, textAlign: 'right' }}>{c.r.toFixed(3)}</span>
                    </div>
                  </td>
                  <td style={{ padding: '6px 8px' }} className="mono">{c.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
