import Link from 'next/link';
import { getDatasetSummary, listWaferSteps } from '@/lib/data/queries';
import { scanRisk } from '@/lib/spc/scan';

export const dynamic = 'force-dynamic';

function Kpi({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="card">
      <div className="card-title">{label}</div>
      <div className="kpi-value">
        {value}
        {unit && <span className="kpi-unit">{unit}</span>}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const [summary, risk, waferSteps] = await Promise.all([
    getDatasetSummary(),
    scanRisk(8),
    listWaferSteps(),
  ]);

  const recent = [...waferSteps].reverse().slice(0, 8);

  return (
    <>
      <header className="page-head">
        <h1 className="page-title">대시보드</h1>
        <p className="page-sub">SupraXP 드라이스트립 설비 · 공정 상태 개요</p>
      </header>

      {/* 운영 질문 1: 규모/건강 — KPI */}
      <section className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <Kpi label="총 샘플" value={summary.rows.toLocaleString()} />
        <Kpi label="웨이퍼 런" value={summary.waferRuns} />
        <Kpi label="Recipe" value={summary.recipes} />
        <Kpi label="Stage / Step" value={`${summary.stages} / ${summary.steps}`} unit={`${summary.lots} Lot`} />
        <Kpi label="SPC 위반(상위 스캔)" value={risk.totalAlarms} unit={`+${risk.totalWarns} 경고`} />
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1rem', alignItems: 'start' }}>
        {/* 운영 질문 2+4: 어디가 위험한가 / 어떤 조치 — 위험 순위 */}
        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span className="card-title">공정 위험 순위 (상위 컨텍스트 × 핵심 신호)</span>
            <span className="muted mono" style={{ fontSize: '0.75rem' }}>{risk.scanned} 조합 스캔</span>
          </div>
          {risk.entries.length === 0 ? (
            <div className="empty-state">스캔 범위 내 관리도 위반이 없습니다.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--color-text-dim)' }}>
                  <th style={{ padding: '4px 8px' }}>신호 / 컨텍스트</th>
                  <th style={{ padding: '4px 8px' }}>런</th>
                  <th style={{ padding: '4px 8px' }}>위반</th>
                  <th style={{ padding: '4px 8px' }}></th>
                </tr>
              </thead>
              <tbody>
                {risk.entries.slice(0, 12).map((e, i) => {
                  const params = new URLSearchParams({
                    recipe: e.recipe, stage: e.stage, step: String(e.recipeStepNum), signal: e.signal,
                  });
                  return (
                    <tr key={i} style={{ borderTop: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '6px 8px' }}>
                        <span className="mono">{e.signal}</span>
                        <div className="muted" style={{ fontSize: '0.72rem' }}>
                          {e.recipe} / {e.stage} / Step {e.recipeStepNum}
                        </div>
                      </td>
                      <td style={{ padding: '6px 8px' }} className="mono">{e.waferRuns}</td>
                      <td style={{ padding: '6px 8px' }}>
                        {e.alarms > 0 && <span className="badge badge-alarm">{e.alarms}</span>}{' '}
                        {e.warns > 0 && <span className="badge badge-warn">{e.warns}</span>}
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <Link href={`/spc?${params}`} className="mono" style={{ color: 'var(--color-accent)', fontSize: '0.75rem' }}>
                          관리도 →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {/* 운영 질문 3: 무엇이 바뀌었나 — 최근 런 */}
        <section className="card">
          <span className="card-title">최근 웨이퍼 런</span>
          <ul style={{ listStyle: 'none', marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {recent.map((w, i) => (
              <li key={i} style={{ fontSize: '0.8rem', borderTop: i ? '1px solid var(--color-border)' : 'none', paddingTop: i ? '0.5rem' : 0 }}>
                <span className="mono">{w.lot} · W{w.waferNo}</span>
                <div className="muted" style={{ fontSize: '0.72rem' }}>
                  {w.recipe} / Step {w.recipeStepNum} · {w.startTime.replace('T', ' ')}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
