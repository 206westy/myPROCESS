'use client';

/** 위반 목록 — 운영 질문 "어떤 조치가 필요한가?"에 답한다 */

import type { ControlChartResult } from '@/lib/spc/types';

export default function ViolationList({ result }: { result: ControlChartResult }) {
  const { violations, points } = result;

  if (violations.length === 0) {
    return (
      <div className="card">
        <span className="card-title">위반 내역</span>
        <div className="empty-state" style={{ marginTop: '1rem' }}>
          탐지된 관리도 위반이 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <span className="card-title">위반 내역 ({violations.length})</span>
      <ul style={{ listStyle: 'none', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {violations.map((v, i) => {
          const p = points[v.index];
          return (
            <li
              key={`${v.index}-${v.rule}-${i}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem' }}
            >
              <span className={`badge ${v.severity === 'alarm' ? 'badge-alarm' : 'badge-warn'}`}>
                {v.severity === 'alarm' ? '위반' : '경고'}
              </span>
              <span className="mono" style={{ minWidth: 110 }}>
                {p ? `${p.lot}·W${p.waferNo}` : `#${v.index}`}
              </span>
              <span className="muted">{v.message}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
