import SpcExplorer from '@/components/spc/SpcExplorer';

export default function SpcPage() {
  return (
    <>
      <header className="page-head">
        <h1 className="page-title">컨텍스트 적응형 SPC</h1>
        <p className="page-sub">
          Recipe·Stage·Step 컨텍스트별로 관리한계를 동적 산출 — 전역 고정 한계가 아닌, 그 공정 맥락에 맞는 통계적 관리.
        </p>
      </header>
      <SpcExplorer />
    </>
  );
}
