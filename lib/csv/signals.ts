/**
 * 센서 신호 메타데이터 — 120개(실측 119개) 신호를 설비 서브시스템으로
 * 분류하고 UI 그룹/라벨을 제공한다. 신호의 아날로그/플래그 구분은 이름이
 * 아니라 인제스트 시 산출되는 `signal_stats`(실데이터 기반)가 최종 권위다.
 * 여기서는 그룹 분류와 표시 라벨만 담당한다.
 */

import { SIGNAL_COLUMNS } from './columns';

export type SubsystemKey =
  | 'apc'
  | 'gas'
  | 'rf_match'
  | 'rf_source'
  | 'pin'
  | 'thermal'
  | 'cooling'
  | 'epd'
  | 'vacuum'
  | 'interlock';

export interface Subsystem {
  key: SubsystemKey;
  /** 한글 표시명 */
  label: string;
  /** 영문 부제 */
  sub: string;
}

/** 서브시스템 정의(표시 순서) */
export const SUBSYSTEMS: readonly Subsystem[] = [
  { key: 'apc', label: '압력 제어', sub: 'APC / Throttle Valve' },
  { key: 'gas', label: '가스 MFC', sub: 'Gas Flow / Pressure' },
  { key: 'rf_source', label: 'RF 소스 파워', sub: 'Source Power' },
  { key: 'rf_match', label: 'RF 매처', sub: 'Matcher VC / VDC' },
  { key: 'pin', label: '리프트 핀', sub: 'Lift-Pin Servo' },
  { key: 'thermal', label: '열 / 온도', sub: 'Wall / Heater / Temp' },
  { key: 'cooling', label: '냉각수', sub: 'Water Flow' },
  { key: 'epd', label: '종말점 검출', sub: 'EPD Monitor' },
  { key: 'vacuum', label: '진공 / 챔버', sub: 'Chamber / Vacuum' },
  { key: 'interlock', label: '인터락 / 상태', sub: 'Interlock / Status' },
] as const;

const SUBSYSTEM_BY_KEY = new Map<SubsystemKey, Subsystem>(
  SUBSYSTEMS.map((s) => [s.key, s]),
);

/** 신호명 → 서브시스템 분류 규칙(접두/키워드 순서대로 평가) */
function classify(signal: string): SubsystemKey {
  if (signal.startsWith('APC_')) return 'apc';
  if (signal.startsWith('EPD_')) return 'epd';
  if (signal.startsWith('Mat_')) return 'rf_match';
  if (signal.startsWith('Pin_')) return 'pin';
  if (
    signal.startsWith('SourcePwr') ||
    signal.startsWith('Source_') ||
    signal === 'SOURCE_ON_TIME'
  ) {
    return 'rf_source';
  }
  if (signal.startsWith('Gas') || signal === 'N2_Purge_Gas_Valve') return 'gas';
  if (
    signal.startsWith('Water_Flow') ||
    signal === 'Gen_Water_Flow_SW' ||
    signal === 'Gen_Rack_Water_Leak'
  ) {
    return 'cooling';
  }
  if (
    signal.startsWith('Wall_') ||
    signal.startsWith('Heater_') ||
    signal.startsWith('VacLine') ||
    signal === 'Temp' ||
    signal === 'Temp_Set'
  ) {
    return 'thermal';
  }
  if (
    signal.startsWith('Chamber_') ||
    signal === 'Pressure' ||
    signal === 'ATM_Sensor' ||
    signal === 'Bara_Protect_Valve' ||
    signal === 'Fast_Vent_Valve' ||
    signal === 'Slow_Vac_Valve'
  ) {
    return 'vacuum';
  }
  // 나머지: 도어/팬/누설/인터락/상태 플래그
  return 'interlock';
}

/** 이름 기반 1차 타입 힌트(권위는 signal_stats). 관리도 후보 선별 보조용. */
const ANALOG_HINTS = [
  'Position', 'Pressure', 'Temp', 'VDC', 'VPP', 'Vrms', 'Irms', 'Phase',
  'Read', 'Reflect', 'Monitor', 'Displacement', 'SetPoint', 'Volt',
  'SetWatt', 'ON_TIME', 'Limit_Temp', 'Set1', 'Preset',
];

function looksAnalog(signal: string): boolean {
  return ANALOG_HINTS.some((h) => signal.includes(h));
}

export interface SignalMeta {
  /** 신호명(= DB 컬럼명) */
  name: string;
  subsystem: SubsystemKey;
  subsystemLabel: string;
  /** 이름 기반 아날로그 추정(데이터 권위 아님) */
  analogHint: boolean;
}

/** 전체 신호 메타 맵 */
export const SIGNAL_META: ReadonlyMap<string, SignalMeta> = new Map(
  SIGNAL_COLUMNS.map((name) => {
    const subsystem = classify(name);
    return [
      name,
      {
        name,
        subsystem,
        subsystemLabel: SUBSYSTEM_BY_KEY.get(subsystem)!.label,
        analogHint: looksAnalog(name),
      },
    ];
  }),
);

/** 서브시스템별로 그룹화된 신호 목록 반환 */
export function signalsBySubsystem(): { subsystem: Subsystem; signals: SignalMeta[] }[] {
  return SUBSYSTEMS.map((subsystem) => ({
    subsystem,
    signals: SIGNAL_COLUMNS.map((name) => SIGNAL_META.get(name)!).filter(
      (m) => m.subsystem === subsystem.key,
    ),
  }));
}

export function getSignalMeta(name: string): SignalMeta | undefined {
  return SIGNAL_META.get(name);
}
