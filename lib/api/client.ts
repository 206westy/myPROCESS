/** 클라이언트 측 fetch — API 엔벨로프를 풀어 data를 반환하거나 throw */

import type { ApiEnvelope } from './response';

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok || !body.success || body.data === null) {
    throw new Error(body.error ?? `요청 실패 (${res.status})`);
  }
  return body.data;
}
