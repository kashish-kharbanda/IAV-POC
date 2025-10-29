import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  try {
    const path = join(process.cwd(), "LKAS_G2.0_Item_Definition.pdf");
    const content = await readFile(path);
    const ab = new ArrayBuffer(content.byteLength);
    new Uint8Array(ab).set(content);
    const body = new Blob([ab], { type: "application/pdf" });
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: "Recent PDF not found" }, { status: 404 });
  }
}


