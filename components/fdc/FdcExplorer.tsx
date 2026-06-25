'use client';

/**
 * FDC 트레이스 탐색기 — 웨이퍼 런별 고주파 트레이스를 다중 신호로
 * 오버레이해 형상을 비교한다(고장 검출/분류 기반 탐색).
 *
 * Lot → Wafer → Step 캐스케이드로 한 웨이퍼 스텝을 고른 뒤, 신호를
 * 최대 6개까지 선택하면 정규화 오버레이 트레이스가 표시된다.
 */

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { fetchJson } from '@/lib/api/client';
import type { TraceSeries, WaferStepRow } from '@/lib/api/types';
import SignalPicker from './SignalPicker';

const TraceChart = dynamic(() => import('@/components/charts/TraceChart'), {
  ssr: false,
  loading: () => <div className="empty-state">차트 로딩 중…</div>,
});

const MAX_SIGNALS = 6;

export default function FdcExplorer() {
  const [waferSteps, setWaferSteps] = useState<WaferStepRow[]>([]);
  const [lot, setLot] = useState('');
  const [wafer, setWafer] = useState('');
  const [step, setStep] = useState<number | null>(null);
  const [signals, setSignals] = useState<string[]>([]);
  const [trace, setTrace] = useState<TraceSeries | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchJson<{ waferSteps: WaferStepRow[] }>('/api/wafers')
      .then((d) => setWaferSteps(d.waferSteps))
      .catch((e) => setError(String(e)));
  }, []);

  const lots = useMemo(
    () => [...new Set(waferSteps.map((w) => w.lot))],
    [waferSteps],
  );
  const wafers = useMemo(
    () => [...new Set(waferSteps.filter((w) => w.lot === lot).map((w) => w.waferNo))],
    [waferSteps, lot],
  );
  const steps = useMemo(
    () =>
      waferSteps
        .filter((w) => w.lot === lot && w.waferNo === wafer)
        .map((w) => ({ step: w.recipeStepNum, samples: w.samples, recipe: w.recipe, stage: w.stage }))
        .sort((a, b) => a.step - b.step),
    [waferSteps, lot, wafer],
  );

  const current = useMemo(
    () => waferSteps.find((w) => w.lot === lot && w.waferNo === wafer && w.recipeStepNum === step),
    [waferSteps, lot, wafer, step],
  );

  useEffect(() => {
    if (!lot || !wafer || step === null || signals.length === 0) {
      setTrace(null);
      return;
    }
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      lot,
      wafer,
      step: String(step),
      signals: signals.join(','),
    });
    fetchJson<TraceSeries>(`/api/trace?${params}`)
      .then(setTrace)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [lot, wafer, step, signals]);

  const onLot = (v: string) => { setLot(v); setWafer(''); setStep(null); };
  const onWafer = (v: string) => { setWafer(v); setStep(null); };

  return (
    <>
      <div className="toolbar">
        <label className="field">
          <span className="field-label">Lot</span>
          <select value={lot} onChange={(e) => onLot(e.target.value)}>
            <option value="">선택…</option>
            {lots.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Wafer</span>
          <select value={wafer} onChange={(e) => onWafer(e.target.value)} disabled={!lot}>
            <option value="">선택…</option>
            {wafers.map((w) => <option key={w} value={w}>W{w}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Step</span>
          <select
            value={step ?? ''}
            onChange={(e) => setStep(Number(e.target.value))}
            disabled={!wafer}
          >
            <option value="">선택…</option>
            {steps.map((s) => (
              <option key={s.step} value={s.step}>Step {s.step} · {s.samples}샘플</option>
            ))}
          </select>
        </label>
      </div>

      {current && (
        <p className="muted" style={{ fontSize: '0.82rem', marginBottom: '1rem' }}>
          {current.recipe} / {current.stage} · 시작 {current.startTime.replace('T', ' ')}
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) 1fr', gap: '1rem', alignItems: 'start' }}>
        <SignalPicker selected={signals} max={MAX_SIGNALS} onChange={setSignals} />

        <div>
          {error && <div className="card" style={{ borderColor: 'var(--color-alarm)' }}>오류: {error}</div>}

          {!trace && !error && (
            <div className="empty-state">
              Lot → Wafer → Step 선택 후, 좌측에서 신호를 1~{MAX_SIGNALS}개 고르면 트레이스가 표시됩니다.
            </div>
          )}

          {trace && (
            <div className="card" style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 150ms' }}>
              <div className="card-title" style={{ marginBottom: '0.5rem' }}>
                정규화 트레이스 오버레이 · {trace.samples}샘플
              </div>
              <TraceChart trace={trace} signals={signals} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
