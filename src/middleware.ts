import { NextRequest, NextResponse } from "next/server";
import {
  WORKSPACE_COOKIE,
  WORKSPACE_COOKIE_MAX_AGE_SECONDS,
} from "@/server/constants";

/**
 * Anonymous per-browser workspaces (decisions.md §10): first visit gets a
 * random id in a cookie and every query is scoped to it. This is where real
 * auth would attach later.
 */
export function middleware(request: NextRequest) {
  if (request.cookies.has(WORKSPACE_COOKIE)) {
    return NextResponse.next();
  }
  const id = crypto.randomUUID();
  // Forwarded to the handler too, so the first request has a workspace.
  const headers = new Headers(request.headers);
  headers.append("cookie", `${WORKSPACE_COOKIE}=${id}`);
  const response = NextResponse.next({ request: { headers } });
  response.cookies.set(WORKSPACE_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: WORKSPACE_COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}
