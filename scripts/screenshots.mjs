/**
 * README용 스크린샷 캡처 — 실행 중인 dev 서버(기본 :3007)의 각 탭을
 * docs/screenshots/*.png 로 저장한다. 셀렉터가 필요한 화면은 자동 선택해
 * 실제 차트가 그려진 상태를 캡처한다.
 *
 *   pnpm dev -p 3007   # (다른 터미널)
 *   node scripts/screenshots.mjs [baseURL]
 */

import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] || 'http://localhost:3007';
const OUT = path.join(process.cwd(), 'docs', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, name, { fullPage = false } = {}) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage });
  console.log(`  ✓ ${name}.png`);
}

/** 캐스케이딩 <select>들을 순서대로 첫 실값(index 1)으로 선택 */
async function pickSelects(page, count) {
  const selects = page.locator('.toolbar select');
  for (let i = 0; i < count; i += 1) {
    const s = selects.nth(i);
    await s.waitFor({ state: 'visible', timeout: 5000 });
    await s.selectOption({ index: 1 }).catch(() => {});
    await sleep(500);
  }
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const capture = async (name, url, fn, opts) => {
    try {
      console.log(`[shot] ${name} ← ${url}`);
      await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(600);
      if (fn) await fn();
      await shot(page, name, opts);
    } catch (e) {
      console.warn(`  ! ${name} 실패: ${e.message}`);
      await shot(page, name).catch(() => {});
    }
  };

  // 즉시 렌더되는 화면
  await capture('dashboard', '/');
  await capture('guide', '/guide');
  await capture('equipment', '/equipment');
  await capture('yield', '/yield');
  await capture('benchmark', '/benchmark');

  // 셀렉터를 구동해야 차트가 그려지는 화면
  await capture('spc', '/spc', async () => {
    await pickSelects(page, 4);        // Recipe→Stage→Step→신호
    await page.locator('canvas').first().waitFor({ timeout: 8000 }).catch(() => {});
    await sleep(1200);
  });

  await capture('mspc', '/mspc', async () => {
    await pickSelects(page, 3);
    await page.locator('canvas').first().waitFor({ timeout: 8000 }).catch(() => {});
    await sleep(1200);
  });

  await capture('commonality', '/commonality', async () => {
    await pickSelects(page, 1);        // 신호
    await sleep(2000);
  });

  await browser.close();
  console.log('\n[screenshots] 완료 →', OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
