import { NextRequest, NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ text: "" });
    let chunks: { text: string }[] = [];
    try {
      chunks = await YoutubeTranscript.fetchTranscript(id);
    } catch {
      // ignore, return empty
    }
    const text = chunks.map(c => c.text).join(" ");
    return NextResponse.json({ text });
  } catch (e: any) {
    return NextResponse.json({ text: "" }, { status: 200 });
  }
}


