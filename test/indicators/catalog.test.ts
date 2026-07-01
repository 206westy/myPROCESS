/**
 * 지표 카탈로그 / SQL 빌더 단위 테스트.
 * DB 없이 순수 로직(카탈로그 무결성·SQL 생성·인젝션 가드)만 검증한다.
 */

import { describe, it, expect } from 'vitest';
import {
  INDICATORS,
  CHARTABLE_INDICATORS,
  INDICATOR_IDS,
  assertIndicator,
  getIndicator,
  DEFAULT_INDICATOR,
} from '../../lib/indicators/catalog';
import {
  buildIndicatorsTableSql,
  buildIndicatorIndexSql,
  INDICATORS_TABLE,
} from '../../lib/indicators/sql';
import { SIGNAL_COLUMNS } from '../../lib/csv/columns';

describe('지표 카탈로그', () => {
  it('지표 id는 유일하다', () => {
    const ids = INDICATORS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('기본 지표 mean이 카탈로그에 존재하고 chartable이다', () => {
    const m = getIndicator(DEFAULT_INDICATOR);
    expect(m).toBeDefined();
    expect(m?.chartable).toBe(true);
  });

  it('chartable 지표는 전체 부분집합이다', () => {
    expect(CHARTABLE_INDICATORS.length).toBeLessThan(INDICATORS.length);
    expect(CHARTABLE_INDICATORS.every((i) => i.chartable)).toBe(true);
  });

  it('알 수 없는 지표는 throw(인젝션 가드)', () => {
    expect(() => assertIndicator('mean); DROP TABLE trace;--')).toThrow();
    expect(() => assertIndicator('nope')).toThrow();
    expect(assertIndicator('median').id).toBe('median');
  });

  it('sql 표현식은 신호 컬럼명을 포함한다', () => {
    const slope = getIndicator('slope')!;
    expect(slope.sql('APC_Pressure')).toContain('APC_Pressure');
    expect(slope.sql('APC_Pressure')).toContain('regr_slope');
  });
});

describe('지표 테이블 SQL 빌더', () => {
  const ddl = buildIndicatorsTableSql();

  it('CREATE TABLE + UNION ALL로 전체 신호를 덮는다', () => {
    expect(ddl).toContain(`CREATE TABLE ${INDICATORS_TABLE}`);
    // 신호 수 - 1 개의 UNION ALL
    const unions = ddl.split('UNION ALL').length - 1;
    expect(unions).toBe(SIGNAL_COLUMNS.length - 1);
  });

  it('모든 지표 컬럼 alias가 DDL에 등장한다', () => {
    for (const id of INDICATOR_IDS) {
      expect(ddl).toContain(`AS ${id}`);
    }
  });

  it('인덱스 DDL 2개를 생성한다', () => {
    const idx = buildIndicatorIndexSql();
    expect(idx).toHaveLength(2);
    expect(idx.every((s) => s.includes(INDICATORS_TABLE))).toBe(true);
  });
});
