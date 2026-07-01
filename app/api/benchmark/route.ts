/**
 * GET /api/benchmark
 * 합성 결함 시나리오에서 SPC 방법들을 비교(ARL/FAR/탐지력). 결정적(시드 고정).
 */

import { runScenario, METHOD_LABELS } from '@/lib/bench/harness';
import type { FaultSpec } from '@/lib/bench/inject';
import { ok, fail } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

const SCENARIOS: Array<{ name: string; spec: FaultSpec }> = [
  { name: '작은 평균 시프트 (+1σ)', spec: { type: 'shift', start: 60, magnitude: 1 } },
  { name: '큰 평균 시프트 (+3σ)', spec: { type: 'shift', start: 60, magnitude: 3 } },
  { name: '점진 드리프트 (0.1σ/점)', spec: { type: 'drift', start: 60, magnitude: 0.1 } },
  { name: '단발 스파이크 (+4σ)', spec: { type: 'spike', start: 60, magnitude: 4 } },
];

export async function GET() {
  try {
    const scenarios = SCENARIOS.map(({ name, spec }) => ({
      name,
      ...runScenario(spec, { n: 120, baselineN: 30 }),
    }));
    return ok({ methodLabels: METHOD_LABELS, scenarios });
  } catch (err) {
    console.error('[api/benchmark] 실패:', err);
    return fail('벤치마크 산출 실패', 500);
  }
}
