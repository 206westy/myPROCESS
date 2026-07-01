/**
 * 벤치마크 실행 CLI — `npm run benchmark` (tsx).
 *
 * 여러 합성 결함 시나리오에서 SPC 방법들을 비교해 표로 출력한다.
 * 라벨된 정답(주입 위치)을 알기에 정밀도/재현율·탐지지연·ARL이 객관적이다.
 *
 * 결정적: 시드 기반이라 매 실행 동일 결과(재현 가능).
 */

import { runScenario, METHOD_LABELS, type MethodId } from '../lib/bench/harness';
import type { FaultSpec } from '../lib/bench/inject';

const SCENARIOS: Array<{ name: string; spec: FaultSpec }> = [
  { name: '작은 평균 시프트 (+1σ)', spec: { type: 'shift', start: 60, magnitude: 1 } },
  { name: '큰 평균 시프트 (+3σ)', spec: { type: 'shift', start: 60, magnitude: 3 } },
  { name: '점진 드리프트 (0.1σ/점)', spec: { type: 'drift', start: 60, magnitude: 0.1 } },
  { name: '단발 스파이크 (+4σ)', spec: { type: 'spike', start: 60, magnitude: 4 } },
];

const METHODS: MethodId[] = ['static3sigma', 'frozenImr', 'ewma', 'cusum', 'residual'];

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

function num(v: number | null, d = 2): string {
  if (v === null) return '미탐지';
  if (!Number.isFinite(v)) return '∞';
  return v.toFixed(d);
}

console.log('\n===== 적응형 SPC 방법 벤치마크 (합성 결함 주입) =====');
console.log('지표: P=정밀도 R=재현율 F1 / 지연=탐지지연(점) / FAR=거짓경보율 / ARL0=정상시 거짓알람간격(↑좋음) ARL1=시프트시 탐지속도(↓좋음)\n');

for (const { name, spec } of SCENARIOS) {
  console.log(`\n■ 시나리오: ${name}  (start=${spec.start})`);
  console.log(
    pad('방법', 22) +
      pad('P', 7) +
      pad('R', 7) +
      pad('F1', 7) +
      pad('지연', 7) +
      pad('FAR', 8) +
      pad('ARL0', 8) +
      pad('ARL1', 7),
  );
  console.log('-'.repeat(73));
  const report = runScenario(spec, { n: 120, baselineN: 30 });
  for (const method of METHODS) {
    const r = report.results.find((x) => x.method === method);
    if (!r) continue;
    const m = r.metrics;
    console.log(
      pad(METHOD_LABELS[method], 22) +
        pad(num(m.precision), 7) +
        pad(num(m.recall), 7) +
        pad(num(m.f1), 7) +
        pad(num(m.detectionDelay, 0), 7) +
        pad(num(m.falseAlarmRate), 8) +
        pad(num(r.arl0, 0), 8) +
        pad(num(r.arl1, 1), 7),
    );
  }
}

console.log('\n해석 가이드:');
console.log('- 정적 3σ는 결함이 한계 계산을 오염시켜 FAR↑·재현율↓ (현행 함정).');
console.log('- 동결 I-MR은 베이스라인이 깨끗해 FAR↓. 작은 시프트는 EWMA/CUSUM이 더 빨리(지연↓) 잡음.');
console.log('- 큰 시프트/스파이크는 Shewhart 계열(동결 I-MR)이 즉시 탐지.');
console.log('- 드리프트는 잔차 차트가 추세를 제거해 거짓알람을 줄임.\n');
