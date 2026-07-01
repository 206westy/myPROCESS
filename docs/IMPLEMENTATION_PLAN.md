# 적응형·컨텍스트 인식 SPC/FDC 구현 계획 & 진행 상태

> 승인 범위: **전체 8단계 + 합성 결함 주입**. 이 문서는 컨텍스트 압축 후에도
> 결정적으로 작업을 이어가기 위한 단일 출처(progress + 모듈 스펙)다.

## 설계 원칙 (앞선 논의 결론)
- **관리한계(control) ≠ 규격(spec)**: 관리한계는 컨텍스트 따라 변함(정상), 규격은 고정.
- **베이스라인 동결**: 골든 구간에서 한계를 1회 산출·동결. 매 런 재계산 금지.
- **컨텍스트 세분화**: recipe×stage×step + 웨이퍼타입/상태. 이질 모집단 풀링 방지.
- **드리프트/자기상관 대응**: lag-1 자기상관·변화점 탐지 → EWMA/AR(1) 잔차차트 추천.
- **Trust Score**: σ_within/σ_total 비율로 한계 신뢰도 수치화(우리가 본 6.9배 사례 자동 경고).
- **설명가능**: 모든 수치에 평이한 한 줄 설명. T² 알람은 기여도로 root-cause.
- **벤치마킹 필수**: 합성 결함 주입 → ARL₀/ARL₁/FAR/MTTD/정밀도·재현율로 방법 비교.

## 연구 근거
반도체 SPC 리뷰(Hotelling T²+PCA SPE/Q, 계층구조), 자기상관 EWMA/AEWMA·잔차차트,
DTW+재귀 T² 드리프트 적응, 1-class 정상학습(클래스 불균형), ARL 표준 지표.

## 모듈 아키텍처 & 체크리스트

### Phase 1 — 기반 (lib/spc)
- [x] `stats.ts` — mean/var/std, movingRange(Bar), sigmaFromMovingRange, quantile/median,
      autocorrelation(lag), linearFitByIndex, ar1Fit, D2_N2/SIGMA_K
- [ ] `types.ts` 확장 — ChartType, AdaptiveLimits, TrustScore, BaselineRef, SpecLimits,
      Capability, ContextKey(확장), MultivariateResult, BenchResult 등
- [ ] `variance.ts` — withinSigma/totalSigma 분해 + TrustScore(ratio→등급/설명)
- [ ] `baseline.ts` — 베이스라인 점 선정(기본: 처음 N개 또는 안정구간), 동결 한계 산출
- [ ] `context.ts` — 컨텍스트 키 확장(웨이퍼타입 추론: lot명/system_label 휴리스틱)

### Phase 2 — 적응형 단변량 차트군 (lib/spc/charts + lib/spc)
- [ ] `charts/ewma.ts` — EWMA 통계량 z_t=λx_t+(1-λ)z_{t-1}, 시변 한계, λ 기본 0.2, L=3
- [ ] `charts/cusum.ts` — 양/음 누적합 C+,C−, 한계 H=5σ, k=0.5σ
- [ ] `charts/residual.ts` — AR(1) 잔차에 I-MR 적용(자기상관 보정)
- [ ] `autocorr.ts` — lag-1 자기상관 유의성, 간단 변화점(누적합 기반) 탐지
- [ ] `recommend.ts` — 자기상관/시프트크기/정규성으로 차트 추천 + 근거 문자열

### Phase 3 — 규격 + 공정능력 (lib/spc)
- [ ] `spec.ts` — SpecLimits(usl/lsl/target), setpoint 신호에서 유도, Cp/Cpk/Pp/Ppk
- [ ] `explain.ts` — 모든 지표 → 평이 한국어 설명 문자열 생성기

### Phase 4 — 다변량 FDC (lib/fdc)
- [ ] `pca.ts` — 표준화, 공분산, Jacobi 고유분해, 주성분/분산설명비, 투영
- [ ] `mspc.ts` — Hotelling T²(+F/β 한계), SPE/Q(+한계), 점별 통계량
- [ ] `contribution.ts` — T²/SPE 기여도 분해 → 신호별 root-cause 순위
- [ ] `service.ts` — 컨텍스트 다신호 행렬 조회 + PCA + T²/SPE + 기여도 조립

### Phase 5 — 트레이스 FDC (lib/fdc)
- [ ] `dtw.ts` — DTW 거리(밴드 제약), 정렬 경로
- [ ] `golden-trace.ts` — 베이스라인 트레이스 평균±kσ 엔벨로프, 이탈 점수

### Phase 6 — 벤치마킹 (lib/bench + scripts)
- [ ] `inject.ts` — 합성 결함: 평균시프트/선형드리프트/스파이크/분산증가
- [ ] `arl.ts` — ARL₀/ARL₁(몬테카를로), 첫 알람까지 런길이
- [ ] `metrics.ts` — FAR, 탐지력(power), 정밀도/재현율/F1, MTTD
- [ ] `harness.ts` — 방법×시나리오 매트릭스 실행 → 비교 결과
- [ ] `scripts/benchmark.ts` — 실데이터 컨텍스트에 주입·비교표 출력

### Phase 7 — API + UI (app, components)
- [ ] `app/api/spc` 확장(다차트+trust), `app/api/fdc`, `app/api/spec`, `app/api/benchmark`
- [ ] `lib/api/types.ts` DTO 확장, `lib/validation.ts` 스키마 추가, `lib/data/queries.ts` 행렬조회
- [ ] components/spc: 다중 차트 뷰, TrustBadge, SpecOverlay, 수치 툴팁
- [ ] components/fdc: T²/SPE 차트, 기여도 막대, 골든트레이스 오버레이
- [ ] components/bench: 벤치마크 비교 대시보드

### Phase 8 — 테스트 + 문서
- [ ] test: stats/variance/baseline/ewma/cusum/residual/autocorr/pca/mspc/dtw/inject/metrics
- [ ] `docs/methodology.md` — 수식 + 수치 해설(σ, ARL, T², SPE, Cpk, TrustScore)

## 핵심 상수/기본값
- I-MR: d2=1.128, k=3
- EWMA: λ=0.2, L=3 (작은 시프트 민감)
- CUSUM: k=0.5σ, H=5σ
- TrustScore 등급: ratio<1.5 높음 / 1.5–3 보통 / >3 낮음(한계 신뢰불가 경고)
- 다변량: T² 한계 = 신뢰수준 99% β/F 근사, SPE 한계 = Jackson-Mudholkar 근사

## 검증
`npm run test` · `npm run typecheck` · `node scripts/benchmark.ts` · `npm run build`
