'use client';

/**
 * 컨텍스트 적응형 SPC 탐색기 — 이 플랫폼의 핵심 차별화 화면.
 *
 * 컨텍스트(Recipe→Stage→Step)를 필터 변수처럼 선택하면, 그 컨텍스트에
 * 속한 웨이퍼 점들로부터 **동적으로** 관리한계를 산출해 보여준다.
 * 동일 신호라도 컨텍스트가 바뀌면 한계가 달라진다.
 */

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { fetchJson } from '@/lib/api/client';
import type { ContextMeta, SignalStat } from '@/lib/api/types';
import type { AdaptiveSpcResult } from '@/lib/spc/types';
import { signalsBySubsystem } from '@/lib/csv/signals';
import { CHARTABLE_INDICATORS } from '@/lib/indicators/catalog';
import LimitsReadout from './LimitsReadout';
import AdaptiveInsights from './AdaptiveInsights';
import ViolationList from './ViolationList';

// ECharts는 클라이언트 전용 — SSR 비활성화
const ControlChart = dynamic(() => import('@/components/charts/ControlChart'), {
  ssr: false,
  loading: () => <div className="empty-state">차트 로딩 중…</div>,
});

/** 지표 분류 한글 라벨(드롭다운 그룹) */
const INDICATOR_KIND_LABEL: Record<string, string> = {
  level: '수준',
  dispersion: '산포',
  shape: '형상/동특성',
  meta: '메타',
};

export default function SpcExplorer() {
  const [meta, setMeta] = useState<ContextMeta | null>(null);
  const [recipe, setRecipe] = useState('');
  const [stage, setStage] = useState('');
  const [step, setStep] = useState<number | null>(null);
  const [signal, setSignal] = useState('');
  const [indicator, setIndicator] = useState('mean');
  const [result, setResult] = useState<AdaptiveSpcResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 컨텍스트 메타 로드
  useEffect(() => {
    fetchJson<ContextMeta>('/api/context')
      .then(setMeta)
      .catch((e) => setError(String(e)));
  }, []);

  // 아날로그 신호 집합(SPC에 유효) — 플래그/전무 신호 제외
  const analogSet = useMemo(() => {
    const m = new Map<string, SignalStat>();
    meta?.signals.forEach((s) => {
      if (!s.isFlag && s.nonNull > 0) m.set(s.signal, s);
    });
    return m;
  }, [meta]);

  // 캐스케이딩 옵션
  const recipes = useMemo(
    () => [...new Set(meta?.contexts.map((c) => c.recipe) ?? [])].sort(),
    [meta],
  );
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

  const signalGroups = useMemo(
    () =>
      signalsBySubsystem()
        .map((g) => ({
          ...g,
          signals: g.signals.filter((s) => analogSet.has(s.name)),
        }))
        .filter((g) => g.signals.length > 0),
    [analogSet],
  );

  // 관리도 조회
  useEffect(() => {
    if (!recipe || !stage || step === null || !signal) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ recipe, stage, step: String(step), signal, indicator });
    fetchJson<AdaptiveSpcResult>(`/api/spc?${params}`)
      .then(setResult)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [recipe, stage, step, signal, indicator]);

  // 선택 핸들러(상위 변경 시 하위 초기화 — 불변 갱신)
  const onRecipe = (v: string) => { setRecipe(v); setStage(''); setStep(null); setResult(null); };
  const onStage = (v: string) => { setStage(v); setStep(null); setResult(null); };

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
          <select
            value={step ?? ''}
            onChange={(e) => { setStep(Number(e.target.value)); setResult(null); }}
            disabled={!stage}
          >
            <option value="">선택…</option>
            {steps.map((s) => (
              <option key={s.step} value={s.step}>Step {s.step} · {s.waferRuns}런</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">신호 (아날로그)</span>
          <select value={signal} onChange={(e) => setSignal(e.target.value)} disabled={step === null}>
            <option value="">선택…</option>
            {signalGroups.map((g) => (
              <optgroup key={g.subsystem.key} label={`${g.subsystem.label} · ${g.subsystem.sub}`}>
                {g.signals.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
              </optgroup>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">지표 (FDC indicator)</span>
          <select value={indicator} onChange={(e) => setIndicator(e.target.value)} disabled={!signal}>
            {(['level', 'dispersion', 'shape', 'meta'] as const).map((kind) => {
              const items = CHARTABLE_INDICATORS.filter((i) => i.kind === kind);
              if (items.length === 0) return null;
              return (
                <optgroup key={kind} label={INDICATOR_KIND_LABEL[kind]}>
                  {items.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
                </optgroup>
              );
            })}
          </select>
        </label>
      </div>

      {error && <div className="card" style={{ borderColor: 'var(--color-alarm)' }}>오류: {error}</div>}

      {!result && !error && (
        <div className="empty-state">
          Recipe → Stage → Step → 신호를 선택하면 해당 컨텍스트의 적응형 관리도가 표시됩니다.
        </div>
      )}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', opacity: loading ? 0.5 : 1, transition: 'opacity 150ms' }}>
          <LimitsReadout result={result} />
          <AdaptiveInsights result={result} />
          <div className="card">
            <div className="card-title" style={{ marginBottom: '0.5rem' }}>
              {result.signal}
              <span className="badge badge-ok" style={{ margin: '0 0.4rem' }}>
                {CHARTABLE_INDICATORS.find((i) => i.id === (result.indicator ?? 'mean'))?.label ?? result.indicator}
              </span>
              · {result.context.recipe} / {result.context.stage} / Step {result.context.recipeStepNum}
            </div>
            <ControlChart result={result} />
          </div>
          <ViolationList result={result} />
        </div>
      )}
    </>
  );
}
