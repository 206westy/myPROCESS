/**
 * 컨텍스트 키 확장 — 순수 함수.
 *
 * 기존 컨텍스트는 recipe×stage×step 뿐이라, Bare/aging/제품 등 성격이 다른
 * 웨이퍼가 한 컨텍스트에 섞여 한계가 왜곡됐다(=Trust Score 낮음의 근본 원인).
 * lot 이름 휴리스틱으로 웨이퍼 타입을 추론해 슬라이싱 차원을 한 단계 넓힌다.
 *
 * 데이터에 명시 컬럼이 없으므로 lot 문자열 기반 규칙으로 분류한다. 규칙에
 * 안 걸리면 'product'(실제 생산 로트)로 본다. 규칙은 도메인 합의로 교체 가능.
 */

/** 웨이퍼 타입 분류 */
export type WaferType = 'bare' | 'aging' | 'monitor' | 'product';

interface Rule {
  type: WaferType;
  test: RegExp;
  label: string;
}

/** lot 이름 → 웨이퍼 타입 규칙(위에서부터 우선 매칭) */
const RULES: readonly Rule[] = [
  { type: 'aging', test: /aging|age/i, label: 'aging(시즈닝/에이징)' },
  { type: 'bare', test: /bare|dummy|dmy/i, label: 'bare(베어/더미)' },
  { type: 'monitor', test: /mon|test|ted|qual|qc/i, label: 'monitor(모니터/테스트)' },
];

/** lot 이름에서 웨이퍼 타입을 추론 */
export function classifyWaferType(lot: string): WaferType {
  for (const rule of RULES) {
    if (rule.test.test(lot)) return rule.type;
  }
  return 'product';
}

/** 웨이퍼 타입의 사람이 읽는 라벨 */
export function waferTypeLabel(type: WaferType): string {
  const found = RULES.find((r) => r.type === type);
  return found ? found.label : 'product(실제 생산)';
}

/** 확장 컨텍스트 키 문자열(그룹핑/캐시 키) */
export function contextKey(
  recipe: string,
  stage: string,
  step: number,
  waferType?: WaferType,
): string {
  const base = `${recipe}|${stage}|${step}`;
  return waferType ? `${base}|${waferType}` : base;
}
