'use client';

/**
 * 적응형 SPC 인사이트 — 새 지능형 수치를 평이한 설명과 함께 보여준다.
 * Trust Score(한계 신뢰도) · 차트 추천 · 진단(자기상관/변화점) ·
 * 규격(관리한계와 분리) · 공정능력(Cp/Cpk).
 */

import type { AdaptiveSpcResult, TrustGrade } from '@/lib/spc/types';

function fmt(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1000 || (abs < 0.01 && abs > 0)) return n.toExponential(2);
  return n.toFixed(3);
}

const GRADE_BADGE: Record<TrustGrade, { cls: string; text: string }> = {
  high: { cls: 'badge-ok', text: '신뢰 높음' },
  medium: { cls: 'badge-warn', text: '신뢰 보통' },
  low: { cls: 'badge-alarm', text: '신뢰 낮음' },
};

const CHART_LABEL: Record<string, string> = {
  imr: 'I-MR(개별값)',
  ewma: 'EWMA',
  cusum: 'CUSUM',
  residual: 'AR(1) 잔차',
};

export default function AdaptiveInsights({ result }: { result: AdaptiveSpcResult }) {
  const { trust, recommendation, diagnostics, spec, capability, baseline } = result;
  const badge = GRADE_BADGE[trust.grade];
  const ratioText = Number.isFinite(trust.ratio) ? `${trust.ratio.toFixed(1)}배` : '∞';

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <span className="card-title">적응형 인사이트 (왜 이렇게 판단했나)</span>
        <span className={`badge ${badge.cls}`}>한계 {badge.text}</span>
      </div>

      {/* Trust Score */}
      <div style={{ marginBottom: '1rem' }}>
        <div className="field-label">한계 신뢰도 (전체변동 / 단기변동)</div>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
          <div className="kpi-value" style={{ fontSize: '1.5rem' }}>{ratioText}</div>
          <div className="muted mono" style={{ fontSize: '0.78rem' }}>
            σ_within={fmt(trust.sigmaWithin)} · σ_total={fmt(trust.sigmaTotal)}
          </div>
        </div>
        <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}>{trust.explanation}</p>
      </div>

      {/* 추천 차트 */}
      <div style={{ marginBottom: '1rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem' }}>
        <div className="field-label">추천 관리도</div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="badge badge-ok">{CHART_LABEL[recommendation.recommended] ?? recommendation.recommended}</span>
          <span className="muted" style={{ fontSize: '0.72rem' }}>
            대안: {recommendation.alternatives.map((a) => CHART_LABEL[a] ?? a).join(', ')}
          </span>
        </div>
        <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}>{recommendation.reason}</p>
      </div>

      {/* 진단 + 베이스라인 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem' }}>
        <div>
          <div className="field-label">자기상관 ρ₁</div>
          <div className="mono">{diagnostics.lag1Autocorr.toFixed(2)} {diagnostics.autocorrSignificant && <span className="badge badge-warn">유의</span>}</div>
        </div>
        <div>
          <div className="field-label">변화점</div>
          <div className="mono">{diagnostics.changePointIndex === null ? '없음' : `인덱스 ${diagnostics.changePointIndex}`}</div>
        </div>
        <div>
          <div className="field-label">왜도(비대칭)</div>
          <div className="mono">{diagnostics.skewness.toFixed(2)}</div>
        </div>
        <div>
          <div className="field-label">베이스라인</div>
          <div className="mono">{baseline.n}점 동결</div>
        </div>
      </div>

      {/* 규격 + 공정능력 */}
      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem' }}>
        <div className="field-label">규격(고정) · 출처: {spec.source}</div>
        <div className="mono" style={{ fontSize: '0.82rem', marginBottom: '0.4rem' }}>
          LSL={fmt(spec.lsl)} · Target={fmt(spec.target)} · USL={fmt(spec.usl)}
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.82rem' }}>
          <span>Cp <b className="mono">{fmt(capability.cp)}</b></span>
          <span>Cpk <b className="mono">{fmt(capability.cpk)}</b></span>
          <span>Pp <b className="mono">{fmt(capability.pp)}</b></span>
          <span>Ppk <b className="mono">{fmt(capability.ppk)}</b></span>
        </div>
        <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}>{capability.explanation}</p>
      </div>
    </div>
  );
}
