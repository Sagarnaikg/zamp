import { cookies } from "next/headers";
import { API_MESSAGES, WORKSPACE_COOKIE } from "@/server/constants";

/** Read the workspace id set by the middleware. */
export async function getWorkspaceId(): Promise<string> {
  const store = await cookies();
  const id = store.get(WORKSPACE_COOKIE)?.value;
  // Middleware sets this on every request; missing means it was bypassed.
  if (!id) throw new Error(API_MESSAGES.noWorkspaceCookie);
  return id;
}
