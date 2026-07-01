'use client';

/**
 * 다변량 FDC 탐색기 — 한 컨텍스트의 여러 센서를 Hotelling T² + SPE/Q로
 * 동시 모니터링하고, 알람 웨이퍼의 원인 신호(결합 기여도)를 지목한다.
 */

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { fetchJson } from '@/lib/api/client';
import type { ContextMeta } from '@/lib/api/types';
import type { FdcResult, FdcWaferResult } from '@/lib/fdc/service';
import type { SpcContext } from '@/lib/spc/types';
import { explainT2, explainSpe } from '@/lib/spc/explain';

const MspcChart = dynamic(() => import('@/components/charts/MspcChart'), {
  ssr: false,
  loading: () => <div className="empty-state">차트 로딩 중…</div>,
});

interface FdcResponse extends FdcResult {
  context: SpcContext;
  lots: { lot: string; waferNo: string; time: string }[];
  baselineN: number;
}

export default function MultivariateFdc() {
  const [meta, setMeta] = useState<ContextMeta | null>(null);
  const [recipe, setRecipe] = useState('');
  const [stage, setStage] = useState('');
  const [step, setStep] = useState<number | null>(null);
  const [data, setData] = useState<FdcResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchJson<ContextMeta>('/api/context').then(setMeta).catch((e) => setError(String(e)));
  }, []);

  const recipes = useMemo(() => [...new Set(meta?.contexts.map((c) => c.recipe) ?? [])].sort(), [meta]);
  const stages = useMemo(
    () => [...new Set(meta?.contexts.filter((c) => c.recipe === recipe).map((c) => c.stage) ?? [])].sort(),
    [meta, recipe],
  );
  const steps = useMemo(
    () =>
      meta?.contexts
        .filter((c) => c.recipe === recipe && c.stage === stage)
        .map((c) => ({ step: c.recipeStepNum, waferRuns: c.waferRuns }))
        .sort((a, b) => a.step - b.step) ?? [],
    [meta, recipe, stage],
  );

  useEffect(() => {
    if (!recipe || !stage || step === null) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ recipe, stage, step: String(step) });
    fetchJson<FdcResponse>(`/api/fdc?${params}`)
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [recipe, stage, step]);

  const onRecipe = (v: string) => { setRecipe(v); setStage(''); setStep(null); setData(null); };
  const onStage = (v: string) => { setStage(v); setStep(null); setData(null); };

  const alarms = useMemo(() => data?.results.filter((r) => r.t2Alarm || r.speAlarm) ?? [], [data]);

  return (
    <>
      <div className="toolbar">
        <label className="field">
          <span className="field-label">Recipe</span>
          <select value={recipe} onChange={(e) => onRecipe(e.target.value)}>
            <option value="">선택…</option>
            {recipes.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Stage</span>
          <select value={stage} onChange={(e) => onStage(e.target.value)} disabled={!recipe}>
            <option value="">선택…</option>
            {stages.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Step</span>
          <select value={step ?? ''} onChange={(e) => { setStep(Number(e.target.value)); setData(null); }} disabled={!stage}>
            <option value="">선택…</option>
            {steps.map((s) => <option key={s.step} value={s.step}>Step {s.step} · {s.waferRuns}런</option>)}
          </select>
        </label>
      </div>

      {error && <div className="card" style={{ borderColor: 'var(--color-alarm)' }}>오류: {error}</div>}
      {!data && !error && <div className="empty-state">Recipe → Stage → Step을 선택하면 대표 센서군의 다변량 FDC가 표시됩니다.</div>}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', opacity: loading ? 0.5 : 1, transition: 'opacity 150ms' }}>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span className="card-title">다변량 모델 요약</span>
              <span className={`badge ${alarms.length ? 'badge-alarm' : 'badge-ok'}`}>
                {alarms.length ? `알람 ${alarms.length}` : '이상 없음'}
              </span>
            </div>
            <div className="kpi-grid">
              <div><div className="field-label">신호 수</div><div className="kpi-value" style={{ fontSize: '1.3rem' }}>{data.signals.length}</div></div>
              <div><div className="field-label">주성분 k</div><div className="kpi-value" style={{ fontSize: '1.3rem' }}>{data.k}</div></div>
              <div><div className="field-label">분산설명</div><div className="kpi-value" style={{ fontSize: '1.3rem' }}>{(data.explainedVarianceRatio * 100).toFixed(0)}%</div></div>
              <div><div className="field-label">베이스라인</div><div className="kpi-value" style={{ fontSize: '1.3rem' }}>{data.baselineN}런</div></div>
            </div>
            <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.6rem' }}>{explainT2()}</p>
            <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.3rem' }}>{explainSpe()}</p>
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: '0.5rem' }}>T² / SPE 관리도</div>
            <MspcChart data={data} />
          </div>

          <div className="card">
            <span className="card-title">알람 웨이퍼 · 원인 신호(결합 기여도)</span>
            {alarms.length === 0 ? (
              <div className="empty-state" style={{ marginTop: '0.5rem' }}>한계를 벗어난 웨이퍼가 없습니다.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginTop: '0.5rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--color-text-dim)' }}>
                    <th style={{ padding: '4px 8px' }}>웨이퍼</th>
                    <th style={{ padding: '4px 8px' }}>유형</th>
                    <th style={{ padding: '4px 8px' }}>원인 신호 (상위 3)</th>
                  </tr>
                </thead>
                <tbody>
                  {alarms.map((r: FdcWaferResult) => {
                    const lot = data.lots[r.index];
                    return (
                      <tr key={r.index} style={{ borderTop: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '6px 8px' }} className="mono">{lot ? `${lot.lot}·W${lot.waferNo}` : `#${r.index}`}</td>
                        <td style={{ padding: '6px 8px' }}>
                          {r.t2Alarm && <span className="badge badge-alarm">T²</span>}{' '}
                          {r.speAlarm && <span className="badge badge-warn">SPE</span>}
                        </td>
                        <td style={{ padding: '6px 8px' }} className="mono">
                          {r.topCauses.slice(0, 3).map((c) => `${c.signal} ${c.percent.toFixed(0)}%`).join(' · ')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </>
  );
}
