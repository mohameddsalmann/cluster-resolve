import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ─────────────────────────────────────────────────────────────
// proxy.ts — Next.js 16 network boundary
//
// This is NOT an auth boundary. Authorization lives in server
// guards, Route Handlers, and RLS (§J). This file handles:
//   - session-cookie refresh (added in Phase 2)
//   - security headers
//   - request-id generation
// ─────────────────────────────────────────────────────────────

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);

  // Generate or propagate request-id
  const requestId =
    requestHeaders.get('x-request-id') ??
    `${Date.now().toString(36)}-${crypto.randomUUID()}`;
  requestHeaders.set('x-request-id', requestId);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Security headers
  response.headers.set('x-content-type-options', 'nosniff');
  response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  response.headers.set('x-frame-options', 'DENY');
  response.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');

  // Propagate request-id in the response for traceability
  response.headers.set('x-request-id', requestId);

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
