# EHM 모니터링 플랫폼 (FDC / 컨텍스트 적응형 SPC)

SupraXP 드라이스트립(애싱) 설비의 **EHM(Equipment Health Monitoring) 트레이스 데이터**를 기반으로 한
반도체 설비·공정 모니터링 의사결정 플랫폼.

핵심 차별점: **컨텍스트 적응형 SPC** — 전역 고정 관리한계가 아니라
`Recipe × Stage × Step` 공정 맥락별로 관리한계를 **동적 산출**한다.

## 기술 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | Next.js 15 (App Router) + TypeScript | |
| 데이터 | DuckDB (`@duckdb/node-api`) | CSV 1회 인제스트 → 컬럼형 분석 쿼리 |
| 차트 | ECharts (동적 임포트) | 고주파 트레이스 / 관리도 |
| 검증 | Zod | API 경계 입력 검증 |
| 테스트 | Vitest (+ Playwright 예정) | SPC 수학 단위 테스트 |
| 패키지 | pnpm | |

## 데이터

- 원본: `supraxp_ehm target data/` (32 CSV 파트, 127 컬럼, 107,165 행) — **git 추적 제외**
- 컨텍스트/키 7 컬럼: `Processed Time, Lot, Recipe, Stage, Wafer No., System Label, Recipe_Step_Num`
- 센서 신호 119 컬럼: APC / Gas1–5 / Mat(RF매처) / SourcePwr / Pin / Wall·Temp / Water / EPD …
- 분포: 26 Lot · 8 Recipe · 4 Stage · 9 Step · 292 웨이퍼 런 · 124 컨텍스트 · 55 아날로그 신호

### 파싱 주의

- `System Label`에 콤마 포함(`"HS.Good,SA.Good"`) → DuckDB `read_csv(all_varchar=true)`로 처리
- 타임스탬프 ISO에 밀리초 유무 혼재(`.344Z` vs `Z`) → `try_strptime` 2-포맷 폴백

## 시작하기

```bash
pnpm install

# 1) CSV → DuckDB 인제스트 (data/ehm.duckdb 생성, 지표 테이블 포함, 검증)
pnpm ingest

# 1b) (기존 DB에 지표만 추가/재빌드 — CSV 재인제스트 없이)
pnpm build:indicators

# 1c) (선택) 수율/품질 CSV 연결 — data/quality.csv 있으면 wafer_quality 적재
pnpm load:quality

# 2) 개발 서버
pnpm dev          # http://localhost:3000

# 기타
pnpm build        # 프로덕션 빌드
pnpm typecheck    # tsc --noEmit
pnpm test         # vitest (SPC 수학)
```

> `pnpm ingest`는 원본 CSV가 `supraxp_ehm target data/`에 있어야 동작한다(데이터는 별도 제공).

## 화면

| 경로 | 설명 |
|---|---|
| `/` | 대시보드 — KPI, 공정 위험 순위(핵심 신호×상위 컨텍스트 SPC 스캔), 최근 런 |
| `/spc` | **컨텍스트 적응형 SPC** — 컨텍스트별 동적 관리한계 + WE 룰 + **지표(indicator) 선택** |
| `/fdc` | FDC 트레이스 — 웨이퍼 런별 다중 신호 정규화 오버레이 |
| `/mspc` | 다변량 FDC — 컨텍스트별 PCA + Hotelling T² + SPE/Q + 기여도 |
| `/commonality` | **Commonality** — 이상 웨이퍼가 몰린 컨텍스트(recipe/stage/step/챔버/lot/날짜) ratio-gap 순위 |
| `/equipment` | **장비관리** — 트레이스 재구성 가동률(E10 영감)·평균 런 간격·RF 누적 PM 프록시 |
| `/yield` | **수율 연결** — 지표↔수율 Pearson 상관(데이터 연결 시 활성, 조인 키 lot+wafer_no) |
| `/benchmark` | 검출법 벤치마크(합성 결함·ARL·P/R/F1) |

### FDC 지표 엔진 (`wafer_step_indicators`)

산업 표준 FDC 파이프라인 **Trace → Window → Indicator → SPC/MSPC**의 지표층.
인제스트 시 신호×step별로 표준 지표 카탈로그(mean·median·std·robust_std·slope·area·
overshoot·rate_of_change·percentile 등 20종)를 **단일 패스 집계로 사전계산**해
materialized 테이블에 적재한다(265,727행 · 119신호 · 2,233 웨이퍼×step). SPC/Commonality/
수율 상관이 모두 이 테이블 위에서 동작한다. 정의는 `lib/indicators/catalog.ts` 단일 출처.

## 아키텍처

```
app/
  page.tsx              대시보드(서버 컴포넌트, DB 직접 조회)
  spc/ · fdc/           탐색기 페이지
  api/context|spc|wafers|trace/route.ts   REST(엔벨로프 + Zod 검증)
lib/
  csv/columns.ts        127 컬럼 스키마(인제스트/쿼리 공유)
  csv/signals.ts        119 신호 서브시스템 분류
  data/duckdb.ts        읽기전용 커넥션 싱글톤
  data/queries.ts       Repository 쿼리(신호명 화이트리스트로 인젝션 차단)
  indicators/catalog.ts FDC 지표 카탈로그(20종) — 단일 출처
  indicators/sql.ts     wafer_step_indicators 빌드 SQL
  spc/limits.ts         I-MR 개별값 관리한계(σ = MR_bar / 1.128) — 컨텍스트 적응형
  spc/rules.ts          Western Electric 4 룰
  spc/scan.ts           대시보드 위험 스캔
  spc/(adaptive·baseline·variance·spec·charts/…)  Phase I/II 동결·Cpk/Ppk·EWMA/CUSUM/잔차
  fdc/(pca·mspc·contribution·dtw·golden-trace)    다변량 T²/Q·골든트레이스
  commonality/analyze.ts  이상치(robust z)·ratio-gap·2-비율 z 검정(순수)
  equipment/states.ts   가동/유휴 union 재구성·PM 프록시(순수)
  yield/schema.ts       수율 테이블 계약(plug-in, 조인키 lot+wafer_no)
components/             ControlChart · TraceChart · MspcChart · 탐색기/선택기
scripts/ingest.ts       CSV → DuckDB (+지표 테이블)
scripts/build-indicators.ts  지표 재빌드   scripts/load-quality.ts  수율 적재
```

### SPC 모델

- 관리도 1점 = 한 웨이퍼 런에서 신호의 스텝 구간 평균
- 관리한계 = **그 컨텍스트(Recipe×Stage×Step)에 속한 웨이퍼 점들로부터만** 산출(I-MR)
- 위반: WE Rule 1(3σ 밖) / 2(3중 2점 2σ) / 3(5중 4점 1σ) / 4(연속 8점 한쪽)
- 표본 부족(<8점) 시 `insufficient` 플래그로 한계 불안정성 표시

## 보안

- 신호명은 SQL 식별자로 보간되므로 `SIGNAL_COLUMNS` 화이트리스트로 검증(인젝션 차단)
- 그 외 모든 값은 바인드 파라미터 전달
- API 입력은 Zod 스키마로 경계 검증

## 남은 작업

- Playwright E2E(핵심 플로우) · 쿼리 통합 테스트 · 커버리지 80% 달성
- 위험 스캔 캐싱(대시보드 로드 시 컨텍스트×신호 스캔 비용 절감)
