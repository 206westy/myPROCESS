import BenchmarkTable from '@/components/bench/BenchmarkTable';

export const metadata = { title: '벤치마크 · EHM' };

export default function BenchmarkPage() {
  return (
    <>
      <header className="page-head">
        <h1 className="page-title">SPC 방법 벤치마크</h1>
        <p className="page-sub">합성 결함 주입 기반 객관 비교 · 정적 3σ vs 동결 I-MR vs EWMA/CUSUM vs 잔차</p>
      </header>
      <BenchmarkTable />
    </>
  );
}
