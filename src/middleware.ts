import { NextRequest, NextResponse } from "next/server";

export const WORKSPACE_COOKIE = "workspace_id";

/**
 * Anonymous per-browser workspaces (decisions.md §10): first visit gets a
 * random workspace id in a cookie; every query is scoped to it. This is
 * also exactly where real auth would attach later.
 */
export function middleware(request: NextRequest) {
  if (request.cookies.has(WORKSPACE_COOKIE)) {
    return NextResponse.next();
  }
  const id = crypto.randomUUID();
  // Forward the new cookie to the route handler too — otherwise the very
  // first request would reach handlers without a workspace id.
  const headers = new Headers(request.headers);
  headers.append("cookie", `${WORKSPACE_COOKIE}=${id}`);
  const response = NextResponse.next({ request: { headers } });
  response.cookies.set(WORKSPACE_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
