import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q") || "";
    const key = process.env.SERPAPI_API_KEY;
    if (!key) return NextResponse.json({ error: "Missing SERPAPI_API_KEY" }, { status: 500 });
    if (!q) return NextResponse.json({ items: [] });

    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "youtube");
    url.searchParams.set("search_query", q);
    url.searchParams.set("api_key", key);
    // Optional params: url.searchParams.set("gl","us");

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`SerpAPI failed ${res.status}`);
    const data = await res.json();
    const items =
      (data?.video_results || []).slice(0, 20).map((v: any) => ({
        id: v.video_id,
        title: v.title,
        channel: v.channel?.name || "",
        thumb: v.thumbnail?.static || v.thumbnail || `https://img.youtube.com/vi/${v.video_id}/hqdefault.jpg`,
        duration: v.duration,
      })) || [];

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Search error" }, { status: 500 });
  }
}


