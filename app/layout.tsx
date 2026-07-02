import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: '공정-장비 관리 플랫폼',
  description: '반도체 공정·장비 데이터 기반 FDC / 컨텍스트 적응형 SPC 의사결정 플랫폼',
};

const NAV = [
  { href: '/', label: '대시보드' },
  { href: '/guide', label: '가이드북' },
  { href: '/spc', label: '적응형 SPC' },
  { href: '/fdc', label: 'FDC 트레이스' },
  { href: '/mspc', label: '다변량 FDC' },
  { href: '/commonality', label: 'Commonality' },
  { href: '/equipment', label: '장비관리' },
  { href: '/yield', label: '수율 연결' },
  { href: '/benchmark', label: '벤치마크' },
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <div className="app-shell">
          <aside className="app-sidebar">
            <div className="app-brand">
              <span className="app-brand-mark">공정·장비</span>
              <span className="app-brand-sub">관리 플랫폼 · Process-Equipment</span>
            </div>
            <nav className="app-nav" aria-label="주 메뉴">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="app-nav-link">
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="app-sidebar-foot">SupraXP · Dry-Strip</div>
          </aside>
          <main className="app-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
