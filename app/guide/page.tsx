import GuideBook from '@/components/guide/GuideBook';

export const metadata = { title: '가이드북 · EHM' };

export default function GuidePage() {
  return (
    <>
      <header className="page-head">
        <h1 className="page-title">통계 방법론 가이드북</h1>
        <p className="page-sub">
          사이드탭 각 분석에 쓰인 통계 접근을 고교 수준으로 — 비유 · 반도체 실데이터 · 그래프 · 해석법.
        </p>
      </header>
      <GuideBook />
    </>
  );
}
