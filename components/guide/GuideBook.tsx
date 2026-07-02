'use client';

/**
 * 통계 방법론 가이드북 — 사이드탭 각 분석의 통계 접근을 고교 수준으로 설명.
 * 비유 → 수식(말로) → 반도체 예시(실데이터) → 그래프 → 해석법 → 함정 틀.
 */

import { useState } from 'react';
import dynamic from 'next/dynamic';
import {
  indicatorTraceOption,
  controlChartOption,
  ewmaOption,
  pcaOption,
  commonalityOption,
  yieldScatterOption,
  equipmentOption,
  benchmarkOption,
  pcaVsPlsOption,
  ecdfOption,
} from './teaching/charts';

// ECharts는 클라이언트 전용 — SSR 비활성
const TeachingChart = dynamic(() => import('./teaching/TeachingChart'), {
  ssr: false,
  loading: () => <div className="empty-state">차트 로딩 중…</div>,
});

const SECTIONS = [
  { id: 'overview', label: '0. 큰 그림' },
  { id: 'indicator', label: '1. FDC 지표' },
  { id: 'spc', label: '2. 적응형 SPC' },
  { id: 'mspc', label: '3. 다변량 FDC' },
  { id: 'pca-pls', label: '3+. PCA vs PLS' },
  { id: 'commonality', label: '4. Commonality' },
  { id: 'equipment', label: '5. 장비관리' },
  { id: 'yield', label: '6. 수율 연결' },
  { id: 'cdf', label: '6+. 분포변화(ECDF)' },
  { id: 'benchmark', label: '7. 벤치마크' },
];

function Analogy({ children }: { children: React.ReactNode }) {
  return <div className="callout callout-analogy"><span className="callout-tag">🎯 직관</span>{children}</div>;
}
function ReadIt({ children }: { children: React.ReactNode }) {
  return <div className="callout callout-read"><span className="callout-tag">🔍 이렇게 읽어요</span>{children}</div>;
}
function Pitfall({ children }: { children: React.ReactNode }) {
  return <div className="callout callout-pitfall"><span className="callout-tag">⚠️ 함정</span>{children}</div>;
}
function Formula({ children }: { children: React.ReactNode }) {
  return <div className="formula">{children}</div>;
}
function Chart({ option, height, caption }: { option: Record<string, unknown>; height?: number; caption: string }) {
  return (
    <figure className="guide-figure">
      <TeachingChart option={option} height={height} />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export default function GuideBook() {
  const [active, setActive] = useState('overview');

  const go = (id: string) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="guide-layout">
      <nav className="guide-nav" aria-label="가이드 목차">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            className={`guide-nav-link ${active === s.id ? 'is-active' : ''}`}
            onClick={() => go(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div className="guide-content">
        {/* ── 0. 개요 ── */}
        <section id="overview" className="guide-section">
          <h2>0. 큰 그림 — 데이터가 흐르는 길</h2>
          <p>
            반도체 설비는 웨이퍼 1장을 처리하는 동안 온도·압력·가스·RF 파워 등
            <b> 120여 개 센서</b>를 약 0.3초마다 기록합니다. 이 방대한 트레이스를
            의미 있는 판단으로 바꾸는 표준 흐름은 다음과 같아요. 사이드탭의 각 화면은
            이 흐름의 한 칸씩을 담당합니다.
          </p>
          <div className="pipeline">
            <span>트레이스</span><i>→</i>
            <span>구간 자르기</span><i>→</i>
            <span className="hot">지표 뽑기</span><i>→</i>
            <span>SPC·다변량</span><i>→</i>
            <span>이상 검출</span><i>→</i>
            <span>원인/수율 연결</span>
          </div>
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            핵심 아이디어 하나: <b>“전체를 하나의 잣대로 보지 않는다.”</b> 같은 신호라도
            Recipe·Stage·Step(=공정 맥락)이 다르면 정상 범위가 다르므로, 맥락별로 잣대를
            따로 만듭니다. 이것이 이 플랫폼의 <b>컨텍스트 적응형</b> 철학입니다.
          </p>
        </section>

        {/* ── 1. FDC 지표 ── */}
        <section id="indicator" className="guide-section">
          <h2>1. FDC 지표 — 긴 영상을 몇 개의 숫자로</h2>
          <Analogy>
            2시간짜리 축구 경기를 다 볼 시간이 없다면? “슛 12개, 점유율 55%, 평균 속도”처럼
            <b> 몇 개의 요약 숫자</b>로 경기를 파악하죠. 트레이스도 똑같이 구간마다
            요약 숫자(=지표)로 압축합니다.
          </Analogy>
          <p>
            한 step 구간의 신호값 수백 개를 다음과 같은 <b>지표 20종</b>으로 요약합니다.
          </p>
          <ul className="guide-list">
            <li><b>평균/중앙값</b> — 대표값. 중앙값은 튀는 값에 덜 흔들립니다(로버스트).</li>
            <li><b>표준편차/로버스트 std</b> — 얼마나 흔들리는지(산포).</li>
            <li><b>기울기(slope)</b> — 구간 동안 오르는지/내리는지(드리프트).</li>
            <li><b>면적(적분)</b> — 누적 노출량. <b>오버슈트</b> — 정상값을 얼마나 넘어 튀었나.</li>
          </ul>
          <Formula>로버스트 std ≈ (75퍼센타일 − 25퍼센타일) ÷ 1.349 &nbsp;— IQR로 σ를 추정(이상치에 강함)</Formula>
          <p>
            <b>반도체 예시(실제 데이터):</b> Recipe <span className="mono">!!!!(IT)4%H2N2_BKM</span> ·
            <span className="mono"> PM2 Stage1</span> · Step 5 · 신호 <span className="mono">Gas2_Monitor</span>
            (웨이퍼 89런)에서 평균 <b>53.3</b>, 오버슈트 <b>+9.5</b>가 나왔습니다. 같은 신호의
            다른 step보다 오버슈트가 가장 커서 “가스 흐름이 이 step에서 유독 크게 튄다”는 신호죠.
          </p>
          <Chart option={indicatorTraceOption()} caption="한 step 트레이스: 램프(상승) → 플래토(정상상태) → 하강. 빨간 점이 오버슈트 피크, 점선이 평균." />
          <ReadIt>
            지표는 그 자체로 끝이 아니라 <b>SPC·상관분석의 재료</b>입니다. “평균만” 보던 예전 방식에서
            벗어나 기울기·오버슈트까지 보면, 평균은 정상인데 모양이 이상한 경우도 잡아냅니다.
          </ReadIt>
        </section>

        {/* ── 2. 적응형 SPC ── */}
        <section id="spc" className="guide-section">
          <h2>2. 적응형 SPC — 정상 범위를 데이터가 스스로 정한다</h2>
          <Analogy>
            시험 성적으로 “이상한 학생”을 찾는다고 해봐요. 전교생 평균으로 자르면 불공평하죠.
            <b> 같은 반(=같은 공정 맥락) 안에서</b> 평소 점수 분포를 보고 “여기서 벗어나면 이상”
            이라고 판단하는 게 공정합니다. SPC(통계적 공정 관리)가 이걸 합니다.
          </Analogy>
          <p>
            관리도는 웨이퍼마다 지표값을 하나씩 찍고, <b>중심선(CL)</b>과 <b>관리한계(UCL/LCL)</b>를
            그립니다. 한계는 “평균 ± 3σ”로 잡는데, 여기서 σ(표준편차)는 이웃한 웨이퍼끼리의
            차이(이동범위)로 추정합니다.
          </p>
          <Formula>σ ≈ 이동범위 평균(MR̄) ÷ 1.128 &nbsp;&nbsp;|&nbsp;&nbsp; UCL = CL + 3σ, &nbsp; LCL = CL − 3σ</Formula>
          <p>
            <b>규격(USL/LSL) ≠ 관리한계(UCL/LCL)</b>를 꼭 구분하세요. 규격은 “고객·엔지니어가 정한
            합격선”(고정), 관리한계는 “공정이 실제로 내는 변동”(데이터가 정함). 둘은 완전히 다른 선입니다.
          </p>
          <Chart option={controlChartOption()} caption="웨이퍼 관리도: 파란선=지표값, 주황 점선=관리한계(3σ), 보라 점선=규격. W13이 LCL 아래로 벗어나 WE 룰1 위반(빨간 점)." height={320} />
          <ReadIt>
            점이 주황 점선(관리한계)을 벗어나거나, ‘연속 8점이 한쪽’ 같은 <b>Western Electric 룰</b>에
            걸리면 “공정이 흔들렸다”는 뜻. 규격(보라 점선) 안이어도 관리한계를 벗어나면 경보입니다.
          </ReadIt>
          <p style={{ marginTop: '1rem' }}>
            <b>작은 변화는 EWMA로.</b> 한 점씩 보면 놓치는 완만한 이동(드리프트)은, 과거값을 지수적으로
            누적한 <b>EWMA</b>가 더 빨리 잡습니다. 여기서 중요한 건 <b>두 선은 각자 다른 한계를 쓴다</b>는
            점이에요. EWMA는 평활돼 변동이 작으므로 한계도 훨씬 <b>좁습니다</b>
            (σ<sub>EWMA</sub> = σ·√(λ/(2−λ))). 그래서 원값은 <b>넓은 3σ 한계</b>를 끝내 못 넘지만
            (작은 시프트를 놓침), EWMA는 <b>좁은 자기 한계</b>를 먼저 넘어 조기 경보합니다.
          </p>
          <Formula>σ<sub>EWMA</sub> = σ · √( λ / (2 − λ) ) &nbsp;— 평활할수록(λ 작을수록) 한계가 좁아져 작은 변화에 민감</Formula>
          <Chart option={ewmaOption()} caption="원값(회색)은 넓은 3σ 한계(0.9)를 못 넘어 시프트를 놓치지만, EWMA(파랑)는 좁은 한계(0.3)를 W10에서 먼저 돌파 → 조기 검출." />
          <Pitfall>
            <b>한계를 판정 대상 데이터로 매번 다시 계산하면</b> 드리프트가 한계 안에 흡수돼 영영 못 잡습니다.
            그래서 <b>안정 구간에서 한계를 한 번 정하고 얼어붙(freeze)</b>힌 뒤, 이후 데이터를 그 한계로
            감시합니다(Phase I → Phase II). 맥락이 이질적이면 한계가 지나치게 좁아지는 문제도 이 원리로 다룹니다.
          </Pitfall>
        </section>

        {/* ── 3. 다변량 FDC ── */}
        <section id="mspc" className="guide-section">
          <h2>3. 다변량 FDC — 120개 신호를 2축으로 압축</h2>
          <Analogy>
            성적표에 과목이 120개라면 한눈에 못 봅니다. 그런데 대부분 과목은 서로 연관돼 있어요
            (수학 잘하면 물리도…). 이 <b>연관성을 이용해 “이과 성향”, “암기 성향” 같은 몇 개 축으로
            압축</b>하는 게 <b>PCA(주성분 분석)</b>입니다.
          </Analogy>
          <p>
            신호들을 표준화한 뒤 PCA로 몇 개의 주성분으로 줄이고, 각 웨이퍼를 두 가지 잣대로 봅니다.
          </p>
          <ul className="guide-list">
            <li><b>T²(Hotelling)</b> — 정상 패턴의 중심에서 <b>얼마나 멀리</b> 갔나(방향은 정상이되 크기가 큼).</li>
            <li><b>SPE / Q</b> — 정상 <b>패턴 자체를 벗어났나</b>(센서 간 관계가 깨짐 = 새로운 고장).</li>
          </ul>
          <Chart option={pcaOption()} caption="PCA 2D 지도. 파란 군집=정상. 노란 점=중심에서 멀리(T²↑). 빨간 점=군집 축을 벗어남(SPE↑)." />
          <ReadIt>
            경보가 뜨면 <b>기여도(contribution)</b>로 “어느 신호가 범인인지” 되짚습니다. T²·SPE는
            “뭔가 이상하다”를, 기여도는 “APC인지 Gas인지 RF인지”를 알려줘요. 이것도 맥락별로
            따로 모델을 만들어야 정확합니다.
          </ReadIt>
        </section>

        {/* ── 3+. PCA vs PLS ── */}
        <section id="pca-pls" className="guide-section">
          <h2>3+. PCA vs PLS — 변동을 볼까, 결과를 볼까 <span className="badge badge-warn" style={{ fontSize: '0.65rem' }}>개념 · 확장</span></h2>
          <p>
            자주 하는 오해: “PCA가 <b>결과(수율)에 가장 영향 주는 변수</b>를 찾아준다.” <b>아닙니다.</b>
            PCA는 결과를 아예 보지 않고, X(센서)가 <b>가장 넓게 퍼진 방향</b>만 찾습니다.
            그래서 PCA는 <b>새 탭이 아니라 위 3번 다변량 FDC(T²/SPE)의 엔진</b>으로 이미 쓰이고 있어요.
          </p>
          <Analogy>
            <b>PCA</b>는 “가장 넓게 퍼진 방향”으로 축을 잡습니다(결과 안 봄). <b>PLS</b>는
            “<b>합격과 불합격을 가장 잘 갈라놓는 방향</b>”으로 축을 잡습니다(결과를 봄). 아까 말씀하신
            “두 분석의 결합”이 바로 PLS예요 — <b>결과를 보는 PCA</b>.
          </Analogy>
          <Chart option={pcaVsPlsOption()} caption="같은 데이터, 두 방향. 회색 PC1(분산 최대)로는 합격(초록)·불합격(빨강)이 안 갈림. 보라 PLS축(분산은 작지만)이 결과를 가름. → 분산 큰 방향 ≠ 수율 가르는 방향." height={320} />
          <Pitfall>
            <b>분산이 큰 변수 ≠ 수율 원인.</b> 크게 요동치지만 수율과 무관한 센서는 PCA가 주성분으로
            뽑고, 작게 움직이지만 매번 불량을 만드는 센서는 PCA가 무시할 수 있습니다. 그래서 수율
            분석엔 결과(Y)를 보는 방법이 필요해요.
          </Pitfall>
          <div className="callout" style={{ borderLeftColor: 'var(--color-accent)' }}>
            <span className="callout-tag" style={{ color: 'var(--color-accent)' }}>🚀 수율 데이터가 들어오면 (확장 로드맵)</span>
            <b>① 파이프라인 결합</b> — 다변량 T²/SPE 이상점수 ↔ 합격/불합격을 2-비율 검정으로 연결
            (지금 Commonality 엔진 재사용). <b>② PLS-DA</b> — P/F를 가장 잘 가르는 다변량 축(기존
            PCA 자코비 위에 NIPALS 추가). <b>③ VIP 점수</b> — 어떤 변수가 결과에 중요한지 순위.
            조인 키 <span className="mono">(lot, wafer_no)</span>와 계약은 이미 준비돼 있어, 데이터만 오면 활성화됩니다.
          </div>
        </section>

        {/* ── 4. Commonality ── */}
        <section id="commonality" className="guide-section">
          <h2>4. Commonality — 이상이 어디에 몰려 있나</h2>
          <Analogy>
            학교에서 배탈 난 학생들이 유독 <b>특정 반·특정 급식</b>에 몰려 있다면 원인을 좁힐 수 있죠.
            불량(이상) 웨이퍼가 어떤 <b>step·챔버·Lot·날짜</b>에 몰려 있는지 찾는 게 Commonality입니다.
          </Analogy>
          <p>
            먼저 각 맥락 안에서 <b>로버스트 z</b>(중앙값·MAD 기반)로 튀는 웨이퍼를 “이상”으로 표시합니다.
            그다음 차원값마다 <b>이상 집단 비율 − 정상 집단 비율 = ratio-gap</b>을 계산해 순위를 매기고,
            우연이 아닌지 <b>2-비율 z검정</b>으로 확인합니다.
          </p>
          <Formula>로버스트 z = (값 − 중앙값) ÷ σ̂ &nbsp;(σ̂는 MAD→IQR→표준편차 순 폴백) &nbsp;|&nbsp; ratio-gap = 이상비율 − 정상비율</Formula>
          <Chart option={commonalityOption()} caption="실제 예시(Gas2_Monitor 오버슈트): 이상 웨이퍼가 Step 7·특정 챔버·Lot 'Bare'에 과대표집. 빨강=통계적으로 유의(z≥1.96)." height={260} />
          <ReadIt>
            막대가 길수록 “이상이 그 값에 쏠려 있다”. 빨간 막대(유의)를 우선 의심하세요. 단,
            <b>표본이 너무 적은 값</b>은 우연일 수 있어 최소 표본수로 걸러냅니다.
          </ReadIt>
          <Pitfall>
            이 앱은 수율 데이터가 없어 “이상”을 <b>트레이스 지표의 통계적 이상치</b>로 정의합니다.
            즉 “불량”이 아니라 “평소와 다른 웨이퍼”예요. 진짜 불량과 연결하려면 6번(수율 연결)이 필요합니다.
          </Pitfall>
        </section>

        {/* ── 5. 장비관리 ── */}
        <section id="equipment" className="guide-section">
          <h2>5. 장비관리 — 얼마나 일하고 얼마나 쉬었나</h2>
          <Analogy>
            공장 기계의 “가동률”은 결국 <b>일한 시간 ÷ 전체 시간</b>. 다만 여러 작업이 시간상 겹치면
            단순히 더하면 100%를 넘어버려요. 그래서 겹치는 구간을 <b>하나로 합쳐(union)</b> 실제
            일한 시간을 셉니다.
          </Analogy>
          <p>
            웨이퍼 런의 처리 구간(첫~끝 샘플 시각)으로 가동/유휴 타임라인을 재구성합니다. SEMI E10
            상태 모델에서 아이디어를 빌렸지만, 실제 이벤트 로그가 아니라 <b>트레이스 기반 근사</b>입니다.
          </p>
          <ul className="guide-list">
            <li><b>가동률</b> = 합쳐진 가동시간 ÷ 전체 구간</li>
            <li><b>평균 런 간격</b> — 고장 데이터가 없어 MTBF 대용으로 사용</li>
            <li><b>PM 프록시</b> — RF 누적 가동시간(SOURCE_ON_TIME)이 임계에 가까우면 “정비 권고”</li>
          </ul>
          <Chart option={equipmentOption()} caption="실제 데이터: 전체 7.3일 중 가동(union) 3.5일 → 가동률 47.4%. 겹침을 합치지 않으면 328%가 나오는 오류를 방지." height={220} />
          <ReadIt>
            가동률이 낮으면 유휴가 길다는 뜻 — 긴 유휴 구간은 잠재 다운타임/정비 창일 수 있습니다.
            PM 프록시 막대가 빨개지면 누적 사용이 임계에 도달했다는 신호예요.
          </ReadIt>
        </section>

        {/* ── 6. 수율 연결 ── */}
        <section id="yield" className="guide-section">
          <h2>6. 수율 연결 — 지표와 결과가 함께 움직이나</h2>
          <Analogy>
            키가 크면 몸무게도 대체로 큽니다. 이렇게 <b>둘이 같이 움직이는 정도</b>를 숫자로 나타낸 게
            <b> 상관계수 r</b>(−1 ~ +1). +1은 완전 정비례, −1은 완전 반비례, 0은 무관.
          </Analogy>
          <Formula>r = (x와 y가 함께 벗어난 정도) ÷ (각자 벗어난 정도의 곱) &nbsp;— 피어슨 상관</Formula>
          <p>
            FDC 지표(예: 오버슈트)와 수율/결함을 <b>웨이퍼 단위로 조인(lot + wafer_no)</b>해 상관을
            계산하면, “어떤 공정 변수가 불량과 연결되는지” 순위를 볼 수 있습니다.
          </p>
          <Chart option={yieldScatterOption()} caption="예시(가상): 오버슈트가 클수록 수율이 낮아지는 음의 상관(r≈−0.8). 점들이 우하향 직선을 따름." />
          <ReadIt>
            점들이 <b>선을 따라 촘촘</b>할수록 |r|이 1에 가깝고 관계가 강합니다. 흩어져 있으면 무관(r≈0).
            상관이 강한 신호가 “불량 원인 후보”예요.
          </ReadIt>
          <Pitfall>
            <b>상관 ≠ 인과.</b> 같이 움직인다고 원인은 아닙니다. 또 이 앱은 현재 수율 데이터가 없어 이
            화면은 <span className="mono">data/quality.csv</span>를 넣어야 활성화됩니다(위 그래프는 개념 설명용 가상 데이터).
          </Pitfall>
        </section>

        {/* ── 6+. 누적분포(ECDF) ── */}
        <section id="cdf" className="guide-section">
          <h2>6+. 누적분포(ECDF)로 변화 잡기 — 시프트·모양·꼬리 <span className="badge badge-warn" style={{ fontSize: '0.65rem' }}>개념 · 확장</span></h2>
          <Analogy>
            데이터를 작은 값부터 줄 세워 “여기까지 몇 %”를 그린 게 <b>누적분포(ECDF)</b>. 두 시기의
            곡선을 겹치면 변화가 한눈에 보입니다 — <b>좌우 평행이동 = 평균 시프트</b>,
            <b> 기울기 변화 = 산포(모양) 변화</b>, <b>끝부분 벌어짐 = 꼬리(불량 위험) 변화</b>.
          </Analogy>
          <p>
            이건 지금의 <b>점(point) 관리도를 보완하는 “분포 수준 SPC”</b>입니다. Phase I/II 원리를 그대로
            확장해 <b>안정 구간의 ECDF를 동결</b>해 두고, 현재 데이터의 ECDF와 비교합니다. 두 곡선의
            <b> 최대 세로 격차(K-S 통계량 D)</b>가 크면 “분포가 달라졌다”는 신호예요.
          </p>
          <Formula>K-S: D = max |F_베이스라인(x) − F_현재(x)| &nbsp;— 두 누적분포의 최대 세로 격차 (꼬리 민감형은 Anderson–Darling)</Formula>
          <Chart option={ecdfOption()} caption="베이스라인(회색) 대비 현재(파랑)가 오른쪽으로 이동 + 위쪽 꼬리가 더 벌어짐. 빨간 점선이 K-S 최대 격차 위치." height={300} />
          <ReadIt>
            <b>평균은 안 움직였는데 꼬리만 두꺼워진</b> 경우(규격 근처 웨이퍼 증가)는 3σ 점 관리도가
            놓치기 쉽지만, ECDF/K-S는 곡선 모양 변화로 <b>먼저</b> 잡아냅니다. 규격선(USL/LSL)을 x축에
            같이 그리면 <b>규격 이탈 비율</b>도 곡선에서 바로 읽혀 Cpk를 보완합니다.
          </ReadIt>
          <div className="callout" style={{ borderLeftColor: 'var(--color-accent)' }}>
            <span className="callout-tag" style={{ color: 'var(--color-accent)' }}>🚀 확장 아이디어</span>
            컨텍스트별 <b>베이스라인 ECDF 동결 → 현재와 K-S/PSI 비교</b>로 “분포 드리프트 감시” 탭을
            추가할 수 있습니다. 드리프트 크기는 <b>PSI·Wasserstein 거리</b>, 정규성·꼬리 점검은
            <b> Q-Q 플롯</b>으로. 기존 지표 테이블 위에서 순수 계산으로 구현 가능합니다.
          </div>
        </section>

        {/* ── 7. 벤치마크 ── */}
        <section id="benchmark" className="guide-section">
          <h2>7. 벤치마크 — 검출법 성능을 시험한다</h2>
          <Analogy>
            화재경보기를 고를 때 “불을 얼마나 잘 잡나(놓치지 않나)”와 “괜히 안 울리나(오작동)”를
            시험하죠. 이상 검출법도 똑같이 <b>진짜 이상을 얼마나 잡고, 헛경보는 얼마나 적은지</b>를 겨룹니다.
          </Analogy>
          <ul className="guide-list">
            <li><b>재현율(Recall)</b> — 진짜 이상 중 잡아낸 비율(놓치지 않는 능력).</li>
            <li><b>정밀도(Precision)</b> — 경보 중 진짜인 비율(헛경보가 적은 능력).</li>
            <li><b>F1</b> — 둘의 조화평균(균형 점수). <b>ARL</b> — 헛경보까지 평균 몇 점 걸리나(클수록 좋음).</li>
          </ul>
          <p>
            공정한 시험을 위해 <b>합성 결함을 씨앗값(고정)으로 주입</b>해 “정답”을 알고 평가합니다.
          </p>
          <Chart option={benchmarkOption()} caption="작은 시프트 상황: 정적 3σ는 재현율이 낮지만(자주 놓침), EWMA·CUSUM은 작은 변화를 잘 잡음. 정밀도는 3σ가 약간 높음." height={260} />
          <ReadIt>
            상황에 맞게 고르세요. <b>작고 완만한 드리프트</b>가 걱정이면 EWMA/CUSUM, <b>갑작스런 큰 이탈</b>만
            보면 정적 3σ도 충분. “룰을 많이 켤수록 민감하지만 헛경보(ARL↓)도 늘어난다”는 트레이드오프를 기억하세요.
          </ReadIt>
        </section>

        <p className="muted" style={{ fontSize: '0.8rem', marginTop: '2rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
          모든 그래프는 이 플랫폼의 실제 SupraXP 데이터·검증값에 기반합니다(수율 그래프만 개념 설명용 가상).
          더 깊은 수식은 <span className="mono">docs/methodology.md</span> 참고.
        </p>
      </div>
    </div>
  );
}
