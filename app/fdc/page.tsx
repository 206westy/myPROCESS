import FdcExplorer from '@/components/fdc/FdcExplorer';

export default function FdcPage() {
  return (
    <>
      <header className="page-head">
        <h1 className="page-title">FDC 트레이스</h1>
        <p className="page-sub">
          웨이퍼 런별 고주파 트레이스를 다중 신호로 정규화 오버레이 — 형상 비교로 이상 거동을 탐색.
        </p>
      </header>
      <FdcExplorer />
    </>
  );
}
