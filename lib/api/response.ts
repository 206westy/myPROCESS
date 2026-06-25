/**
 * 일관된 API 응답 엔벨로프. 성공/실패를 동일한 형태로 감싼다.
 */

import { NextResponse } from 'next/server';

export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export function ok<T>(data: T): NextResponse<ApiEnvelope<T>> {
  return NextResponse.json({ success: true, data, error: null });
}

export function fail(message: string, status = 400): NextResponse<ApiEnvelope<never>> {
  return NextResponse.json(
    { success: false, data: null, error: message },
    { status },
  );
}
