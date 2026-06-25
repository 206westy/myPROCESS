/**
 * CSV 트레이스 스키마 정의 — 인제스트와 쿼리가 공유하는 단일 출처.
 *
 * 원본 CSV는 127개 컬럼(따옴표 문자열)이며, 앞 7개는 컨텍스트/키,
 * 나머지 120개는 센서 신호다. 컨텍스트 컬럼 일부는 이름에 공백/점이
 * 있어(`"Processed Time"`, `"Wafer No."`, `"System Label"`) 인제스트
 * 시 snake_case DB 컬럼으로 매핑한다. 신호 컬럼은 이미 식별자로
 * 유효(예: `APC_Position`)하므로 원본명을 그대로 보존한다 — DuckDB는
 * 따옴표 없는 식별자를 대소문자 무시로 처리한다.
 */

export interface ContextColumn {
  /** 원본 CSV 헤더명 */
  csv: string;
  /** DB 컬럼명(snake_case) */
  db: string;
  /** DuckDB 캐스트 타입 */
  type: 'TIMESTAMP' | 'VARCHAR' | 'INTEGER';
}

/** 앞 7개 컨텍스트/키 컬럼 — FDC/SPC 슬라이싱 차원 */
export const CONTEXT_COLUMNS: readonly ContextColumn[] = [
  { csv: 'Processed Time', db: 'processed_time', type: 'TIMESTAMP' },
  { csv: 'Lot', db: 'lot', type: 'VARCHAR' },
  { csv: 'Recipe', db: 'recipe', type: 'VARCHAR' },
  { csv: 'Stage', db: 'stage', type: 'VARCHAR' },
  { csv: 'Wafer No.', db: 'wafer_no', type: 'VARCHAR' },
  { csv: 'System Label', db: 'system_label', type: 'VARCHAR' },
  { csv: 'Recipe_Step_Num', db: 'recipe_step_num', type: 'INTEGER' },
] as const;

/** 컨텍스트를 제외한 추가 메타 컬럼(트레이스 끝 컬럼) */
export const RECIPE_MAX_STEP_CSV = 'Recipe_Max_Step';

/**
 * 120개 센서 신호 컬럼(CSV 원본명 = DB 컬럼명).
 * `Recipe_Max_Step`은 신호가 아닌 메타로 분리한다.
 */
export const SIGNAL_COLUMNS: readonly string[] = [
  'APC_Close_Check', 'APC_Mode_Set', 'APC_Open_Check', 'APC_Position', 'APC_Pressure',
  'APC_SetPoint', 'APC_Status', 'APC_Valve_Control', 'ATM_Sensor', 'Bara_Protect_Valve',
  'Chamber_Open_Intlk', 'Chamber_Pressure', 'DNB1_Fan_Status', 'ELT_Box_Fan_Status',
  'ELT_Box_Intlk', 'EPD_Amp_Monitor1', 'EPD_Amp_Monitor2', 'EPD_Monitor1', 'EPD_Monitor2',
  'Fast_Vent_Valve', 'Gas1_Monitor', 'Gas1_Pressure', 'Gas1_Purge_Valve', 'Gas1_Set',
  'Gas1_Set_Offset', 'Gas1_Temp', 'Gas1_Valve', 'Gas1_Volt', 'Gas2_Monitor', 'Gas2_Pressure',
  'Gas2_Purge_Valve', 'Gas2_Set', 'Gas2_Set_Offset', 'Gas2_Temp', 'Gas2_Valve', 'Gas2_Volt',
  'Gas3_Monitor', 'Gas3_Pressure', 'Gas3_Set', 'Gas3_Set_Offset', 'Gas3_Temp', 'Gas3_Valve',
  'Gas3_Volt', 'Gas4_Monitor', 'Gas4_Pressure', 'Gas4_Set', 'Gas4_Set_Offset', 'Gas4_Temp',
  'Gas4_Valve', 'Gas4_Volt', 'Gas5_Monitor', 'Gas5_Pressure', 'Gas5_Set', 'Gas5_Set_Offset',
  'Gas5_Temp', 'Gas5_Valve', 'Gas5_Volt', 'Gas_Box_Door_Intlk', 'Gas_Exhaust_Alarm',
  'Gen_Rack_Door_SW', 'Gen_Rack_Water_Leak', 'Gen_Water_Flow_SW', 'H2_Leak_Alarm',
  'Heater_OnOff', 'Heater_OverHeat', 'Mat_Alarm', 'Mat_Auto_Manual', 'Mat_Irms', 'Mat_Mode',
  'Mat_Phase', 'Mat_Preset', 'Mat_Preset_Go', 'Mat_RFOn', 'Mat_Tuned', 'Mat_VC1_Position',
  'Mat_VC1_Preset', 'Mat_VC2_Position', 'Mat_VC2_Preset', 'Mat_VDC', 'Mat_VPP', 'Mat_Vrms',
  'N2_Purge_Gas_Valve', 'Pin_Displacement', 'Pin_Init_Status', 'Pin_Origin',
  'Pin_Origin_Status', 'Pin_Point_Control', 'Pin_Position', 'Pin_Position_Control',
  'Pin_Run_Status', 'Pin_Servo_Control', 'Pin_Servo_Status', 'Pin_Speed_Control', 'Pressure',
  'SOURCE_ON_TIME', 'Slow_Vac_Valve', 'SourcePwr_ON', 'SourcePwr_RESET', 'SourcePwr_Read',
  'SourcePwr_Reflect', 'SourcePwr_Set1', 'SourcePwr_SetWatt', 'SourcePwr_Sts1',
  'SourcePwr_Sts2', 'SourcePwr_Sts3', 'Source_Box_Fan_Sts', 'Temp', 'Temp_Set', 'VacLine_HT_ON',
  'VacLine_Set', 'Wall_Limit_Temp', 'Wall_Over_Temp', 'Wall_Temp_Ctrl', 'Wall_Temp_Monitor',
  'Wall_Temp_Set', 'Water_Flow_Out_Cda1', 'Water_Flow_Out_Cda2', 'Water_Flow_Temp_Mon1',
  'Water_Flow_Temp_Mon2',
] as const;

/** DB 트레이스 테이블명 */
export const TRACE_TABLE = 'trace';
/** 신호 통계(타입 추론용) 테이블명 */
export const SIGNAL_STATS_TABLE = 'signal_stats';
