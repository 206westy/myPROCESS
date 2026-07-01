import YieldBridge from '@/components/yield/YieldBridge';

export const metadata = { title: '수율 연결 · EHM' };

export default function YieldPage() {
  return (
    <>
      <header className="page-head">
        <h1 className="page-title">수율 연결</h1>
        <p className="page-sub">
          FDC 지표 ↔ 수율/결함 상관 — 조인 키 (lot, wafer_no). 수율 데이터 적재 시 활성화.
        </p>
      </header>
      <YieldBridge />
    </>
  );
}
