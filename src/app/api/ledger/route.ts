import { NextResponse } from "next/server";
import { getWorkspaceId } from "@/server/workspace";
import { listLedger } from "@/server/services/ledger";

export async function GET() {
  const workspaceId = await getWorkspaceId();
  return NextResponse.json({ rows: await listLedger(workspaceId) });
}
