/**
 * API 경계 입력 검증(Zod). 외부 데이터는 신뢰하지 않는다 — 모든
 * 쿼리 파라미터를 파싱/검증한 뒤에만 데이터 계층으로 넘긴다.
 */

import { z } from 'zod';

/** SPC 관리도 조회 파라미터 */
export const spcQuerySchema = z.object({
  recipe: z.string().min(1, 'recipe 필수'),
  stage: z.string().min(1, 'stage 필수'),
  step: z.coerce.number().int('step은 정수').nonnegative('step은 0 이상'),
  signal: z.string().min(1, 'signal 필수'),
  /** 분석 지표 id(기본 mean). 지표 화이트리스트는 서비스 계층에서 검증 */
  indicator: z.string().optional().default('mean'),
});

export type SpcQuery = z.infer<typeof spcQuerySchema>;

/** FDC 트레이스 조회 파라미터 */
export const traceQuerySchema = z.object({
  lot: z.string().min(1, 'lot 필수'),
  wafer: z.string().min(1, 'wafer 필수'),
  step: z.coerce.number().int().nonnegative(),
  signals: z
    .string()
    .min(1, 'signals 필수')
    .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean)),
});

export type TraceQuery = z.infer<typeof traceQuerySchema>;

/** 다변량 FDC 조회 파라미터 */
export const fdcQuerySchema = z.object({
  recipe: z.string().min(1, 'recipe 필수'),
  stage: z.string().min(1, 'stage 필수'),
  step: z.coerce.number().int('step은 정수').nonnegative('step은 0 이상'),
  /** 분석 대상 신호(쉼표 구분, 비우면 서버 기본 신호군) */
  signals: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : [])),
});

export type FdcQuery = z.infer<typeof fdcQuerySchema>;

/** Commonality 분석 조회 파라미터 */
export const commonalityQuerySchema = z.object({
  signal: z.string().min(1, 'signal 필수'),
  indicator: z.string().optional().default('mean'),
  /** 분석 범위 recipe(생략 시 전체) */
  recipe: z.string().optional(),
  /** 로버스트 z 임계 */
  k: z.coerce.number().positive().max(10).optional().default(3.5),
});

export type CommonalityQuery = z.infer<typeof commonalityQuerySchema>;

/** URLSearchParams → 평범한 객체 */
export function searchParamsToObject(params: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  params.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}
