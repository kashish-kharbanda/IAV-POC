import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const ver = req.nextUrl.searchParams.get("ver");

  // Search both nested and top-level installations and pick the one matching the requested version
  const bases = [
    join(process.cwd(), "node_modules", "react-pdf", "node_modules", "pdfjs-dist"),
    join(process.cwd(), "node_modules", "pdfjs-dist"),
  ];

  async function tryRead(path: string) {
    try { return await readFile(path); } catch { return null; }
  }

  for (const base of bases) {
    const pkgRaw = await tryRead(join(base, "package.json"));
    if (!pkgRaw) continue;
    let matched = true;
    if (ver) {
      try {
        const pkg = JSON.parse(pkgRaw.toString("utf-8"));
        matched = pkg?.version === ver;
      } catch {}
    }
    if (!matched) continue;

    const workerCandidates = [
      join(base, "build", "pdf.worker.min.mjs"),
      join(base, "build", "pdf.worker.mjs"),
      join(base, "legacy", "build", "pdf.worker.min.js"),
      join(base, "legacy", "build", "pdf.worker.js"),
    ];
    for (const fp of workerCandidates) {
      const content = await tryRead(fp);
      if (!content) continue;
      const ab = new ArrayBuffer(content.byteLength);
      new Uint8Array(ab).set(content);
      const body = new Blob([ab], { type: "text/javascript; charset=utf-8" });
      return new NextResponse(body, {
        headers: {
          "Content-Type": "text/javascript; charset=utf-8",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
  }

  return NextResponse.json({ error: "pdf.js worker not found" }, { status: 404 });
}


