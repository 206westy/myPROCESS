import CommonalityExplorer from '@/components/commonality/CommonalityExplorer';

export const metadata = { title: 'Commonality 분석 · EHM' };

export default function CommonalityPage() {
  return (
    <>
      <header className="page-head">
        <h1 className="page-title">Commonality 분석</h1>
        <p className="page-sub">
          이상 웨이퍼가 어떤 컨텍스트(Recipe·Stage·Step·챔버·Lot·날짜)에 몰려 있는지
          ratio-gap으로 순위화 — 수율 데이터 없이 트레이스 지표 이상치 기반.
        </p>
      </header>
      <CommonalityExplorer />
    </>
  );
}
