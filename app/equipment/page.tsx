import { buildEquipmentReport } from '@/lib/equipment/service';
import { formatDuration } from '@/lib/equipment/states';

export const dynamic = 'force-dynamic';
export const metadata = { title: '장비관리 · EHM' };

function Kpi({ label, value, unit, accent }: { label: string; value: string | number; unit?: string; accent?: string }) {
  return (
    <div className="card">
      <div className="card-title">{label}</div>
      <div className="kpi-value" style={accent ? { color: accent } : undefined}>
        {value}{unit && <span className="kpi-unit">{unit}</span>}
      </div>
    </div>
  );
}

export default async function EquipmentPage() {
  const report = await buildEquipmentReport();
  const { stats, pm } = report;
  const utilPct = (stats.utilization * 100).toFixed(1);
  const pmPct = Math.min(100, pm.ratio * 100).toFixed(0);

  return (
    <>
      <header className="page-head">
        <h1 className="page-title">장비관리</h1>
        <p className="page-sub">
          트레이스 재구성 기반 가동/유휴 분석 (SEMI E10 영감) · RF 누적 가동시간 PM 프록시.
          실제 이벤트 로그가 아닌 처리 구간 근사입니다.
        </p>
      </header>

      <section className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <Kpi label="가동률" value={utilPct} unit="%" accent="var(--color-accent)" />
        <Kpi label="웨이퍼 런" value={stats.runs} />
        <Kpi label="가동 시간" value={formatDuration(stats.productiveMs)} />
        <Kpi label="유휴 시간" value={formatDuration(stats.idleMs)} />
        <Kpi label="평균 런 간격" value={formatDuration(stats.meanIntervalMs)} />
        <Kpi label="최장 유휴" value={formatDuration(stats.longestGapMs)} accent="var(--color-warn)" />
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'start' }}>
        <section className="card">
          <div className="card-title" style={{ marginBottom: '0.75rem' }}>PM 프록시 — RF 누적 가동시간(SOURCE_ON_TIME)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div style={{ flex: 1, height: 14, background: 'var(--color-surface-2)', borderRadius: 7, overflow: 'hidden' }}>
              <div style={{ width: `${pmPct}%`, height: '100%', background: pm.due ? 'var(--color-alarm)' : 'var(--color-ok)' }} />
            </div>
            <span className="mono" style={{ minWidth: 48, textAlign: 'right' }}>{pmPct}%</span>
          </div>
          <p className="muted mono" style={{ fontSize: '0.78rem' }}>
            현재 {pm.current.toLocaleString()} / 임계 {pm.threshold.toLocaleString()}
            {pm.due && <span className="badge badge-alarm" style={{ marginLeft: '0.5rem' }}>PM 권고</span>}
          </p>
          <p className="muted" style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
            임계는 <span className="mono">?pm=</span> 쿼리로 조정. 실제 PM 주기는 장비 사양에 맞춰 설정하세요.
          </p>
        </section>

        <section className="card">
          <div className="card-title" style={{ marginBottom: '0.75rem' }}>
            잠재 다운타임 (유휴 &gt; {formatDuration(stats.downtimeThresholdMs)})
          </div>
          {report.downtimes.length === 0 ? (
            <div className="empty-state">임계 초과 유휴 구간 없음.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--color-text-dim)' }}>
                  <th style={{ padding: '4px 8px' }}>시작</th>
                  <th style={{ padding: '4px 8px' }}>지속</th>
                </tr>
              </thead>
              <tbody>
                {report.downtimes.map((d, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '6px 8px' }} className="mono">{d.start}</td>
                    <td style={{ padding: '6px 8px' }}>
                      <span className="badge badge-warn">{formatDuration(d.durationMs)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="card" style={{ marginTop: '1rem' }}>
        <div className="card-title" style={{ marginBottom: '0.75rem' }}>최근 웨이퍼 런</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--color-text-dim)' }}>
              <th style={{ padding: '4px 8px' }}>시작</th>
              <th style={{ padding: '4px 8px' }}>Lot · Wafer</th>
              <th style={{ padding: '4px 8px' }}>Recipe</th>
              <th style={{ padding: '4px 8px' }}>처리시간</th>
            </tr>
          </thead>
          <tbody>
            {report.recentRuns.slice(0, 15).map((r, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--color-border)' }}>
                <td style={{ padding: '6px 8px' }} className="mono">{r.start}</td>
                <td style={{ padding: '6px 8px' }} className="mono">{r.lot} · W{r.waferNo}</td>
                <td style={{ padding: '6px 8px' }} className="muted">{r.recipe}</td>
                <td style={{ padding: '6px 8px' }} className="mono">{formatDuration(r.durationMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
