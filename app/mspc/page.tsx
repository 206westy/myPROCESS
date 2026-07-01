import MultivariateFdc from '@/components/fdc/MultivariateFdc';

export const metadata = { title: '다변량 FDC · EHM' };

export default function MspcPage() {
  return (
    <>
      <header className="page-head">
        <h1 className="page-title">다변량 FDC (T² · SPE)</h1>
        <p className="page-sub">여러 센서를 함께 본 종합 이상도 + 원인 신호 자동 지목(결합 기여도)</p>
      </header>
      <MultivariateFdc />
    </>
  );
}
