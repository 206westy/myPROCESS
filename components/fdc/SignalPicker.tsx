'use client';

/** 신호 다중 선택기 — 서브시스템별 그룹, 최대 N개 제한 */

import { signalsBySubsystem } from '@/lib/csv/signals';

interface SignalPickerProps {
  selected: string[];
  max: number;
  onChange: (next: string[]) => void;
}

export default function SignalPicker({ selected, max, onChange }: SignalPickerProps) {
  const groups = signalsBySubsystem();
  const selectedSet = new Set(selected);
  const atMax = selected.length >= max;

  const toggle = (name: string) => {
    if (selectedSet.has(name)) {
      onChange(selected.filter((s) => s !== name));
    } else if (!atMax) {
      onChange([...selected, name]);
    }
  };

  return (
    <div className="card" style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span className="card-title">신호 선택</span>
        <span className="muted mono" style={{ fontSize: '0.8rem' }}>
          {selected.length} / {max}
        </span>
      </div>
      <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {groups.map((g) => (
          <div key={g.subsystem.key}>
            <div className="field-label" style={{ marginBottom: 4 }}>
              {g.subsystem.label}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {g.signals.map((s) => {
                const on = selectedSet.has(s.name);
                const disabled = !on && atMax;
                return (
                  <button
                    key={s.name}
                    type="button"
                    className="control"
                    onClick={() => toggle(s.name)}
                    disabled={disabled}
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderColor: on ? 'var(--color-accent)' : undefined,
                      color: on ? 'var(--color-accent)' : undefined,
                      opacity: disabled ? 0.4 : 1,
                    }}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
