import { cookies } from "next/headers";
import { WORKSPACE_COOKIE } from "@/middleware";

/** Read the workspace id set by the middleware. */
export async function getWorkspaceId(): Promise<string> {
  const store = await cookies();
  const id = store.get(WORKSPACE_COOKIE)?.value;
  if (!id) {
    // Middleware sets the cookie on every request; missing means it was
    // bypassed (e.g. a direct API call from curl without cookies).
    throw new Error("No workspace cookie present");
  }
  return id;
}
