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
  const response = NextResponse.next();
  response.cookies.set(WORKSPACE_COOKIE, crypto.randomUUID(), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
