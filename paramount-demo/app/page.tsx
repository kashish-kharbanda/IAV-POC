"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

type YtResult = { id: string; title: string; channel: string; thumb: string; duration?: string };

export default function Page() {
  const [tab, setTab] = useState<"Search" | "Insights" | "Detections">("Search");
  const [q, setQ] = useState("Top Super Bowl ads 2024");
  const [results, setResults] = useState<YtResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<YtResult | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [summary, setSummary] = useState<string>("");

  // Detection
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [detections, setDetections] = useState<Array<{ bbox: [number, number, number, number]; label: string; score: number }>>([]);
  const [detectLoading, setDetectLoading] = useState(false);

  const runSearch = useCallback(async () => {
    setError(null); setLoading(true); setResults([]); setSelected(null); setTranscript(""); setSummary("");
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const data = await res.json();
      setResults(data.items as YtResult[]);
      setTab("Search");
    } catch (e: any) {
      setError(e?.message || "Search error");
    } finally {
      setLoading(false);
    }
  }, [q]);

  const selectVideo = useCallback(async (item: YtResult) => {
    setSelected(item);
    setTranscript(""); setSummary("");
    setTab("Insights");
    try {
      const res = await fetch(`/api/transcript?id=${encodeURIComponent(item.id)}`);
      if (res.ok) {
        const data = await res.json();
        const text: string = data.text || "";
        setTranscript(text);
        const brief = deriveSummary(text);
        setSummary(brief);
      } else {
        setTranscript("");
        setSummary("No transcript available.");
      }
    } catch {
      setTranscript(""); setSummary("Transcript fetch failed.");
    }
  }, []);

  function deriveSummary(text: string): string {
    if (!text) return "No transcript available.";
    const clean = text.replace(/\s+/g, " ").trim();
    const sentences = clean.split(/(?<=[.!?])\s+/).filter(s => s.length > 0);
    const top = sentences.slice(0, 5);
    return `• ${top.join("\n• ")}`;
  }

  const detectOnThumbnail = useCallback(async () => {
    if (!selected) return;
    try {
      setDetectLoading(true);
      const tf = await import("@tensorflow/tfjs");
      await tf.ready();
      const coco = await import("@tensorflow-models/coco-ssd");
      const model = await coco.load({ base: "lite_mobilenet_v2" as any });

      // Load thumbnail image to canvas
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = `https://img.youtube.com/vi/${selected.id}/hqdefault.jpg`;
      await new Promise((res, rej) => { img.onload = () => res(null); img.onerror = rej; });
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      canvas.width = img.width; canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const preds = await (model as any).detect(canvas);
      const interesting = ["bottle", "cup", "wine glass", "book", "tv", "cell phone", "laptop", "backpack", "handbag", "suitcase", "tie", "remote"];
      const filtered = (preds as any[]).filter(p => interesting.includes(p.class) && p.score >= 0.35).map(p => ({
        bbox: p.bbox as [number, number, number, number],
        label: p.class as string,
        score: p.score as number,
      }));
      setDetections(filtered);
      setTab("Detections");
    } catch (e: any) {
      setError(e?.message || "Detection failed");
    } finally {
      setDetectLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    runSearch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main>
      <div className="container">
        <div className="header">
          <div className="brand"><div className="logo" /> Paramount Demo — Video Intelligence</div>
          <div className="badge">Search • Summarize • Detect</div>
        </div>

        <nav className="tabs">
          {(["Search","Insights","Detections"] as const).map(t => (
            <button key={t} className={`tab ${tab===t?"active":""}`} onClick={() => setTab(t)} type="button">{t}</button>
          ))}
        </nav>

        <div className="grid">
          {/* Left: Results / Player / Detections */}
          <section className="card">
            <h2>{tab === "Search" ? "Search Results" : tab === "Insights" ? "Player & Summary" : "Detections"}</h2>
            {tab === "Search" && (
              <>
                {loading ? <div className="muted">Searching…</div> : (
                  <div className="results">
                    {results.map(r => (
                      <div key={r.id} className="result" onClick={() => selectVideo(r)}>
                        <img src={r.thumb} alt={r.title} />
                        <div className="meta">
                          <div className="title">{r.title}</div>
                          <div className="channel">{r.channel}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {tab === "Insights" && selected && (
              <>
                <div className="player" style={{ marginBottom: 10 }}>
                  <iframe
                    width="100%" height="100%"
                    src={`https://www.youtube.com/embed/${selected.id}`}
                    title={selected.title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
                <div className="actions">
                  <button className="btn ok" type="button" onClick={detectOnThumbnail} disabled={detectLoading}>
                    {detectLoading ? "Analyzing…" : "Detect Product Placements"}
                  </button>
                </div>
              </>
            )}

            {tab === "Detections" && selected && (
              <>
                <div className="player" style={{ background: "#000", padding: 0 }}>
                  <canvas ref={canvasRef} className="thumb-canvas" />
                  {detections.map((d, i) => {
                    const [x,y,w,h] = d.bbox;
                    return <div key={i} className="det-box" style={{ left: x, top: y, width: w, height: h }}>{d.label}</div>;
                  })}
                </div>
                <div className="muted" style={{ marginTop: 8 }}>
                  Detected objects on thumbnail. For full-frame detection, integrate a frame sampler and run the same model per frame.
                </div>
              </>
            )}
          </section>

          {/* Right: Controls & Summary */}
          <section className="card">
            <h2>Find Clips</h2>
            <p className="muted">Search YouTube via SerpAPI, then pick a clip to summarize and detect product placements.</p>
            <div className="actions" style={{ marginBottom: 8 }}>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search (e.g., product demo, show name, episode, ad)"
                style={{ flex: "1 1 auto", minWidth: 220, padding: 10, borderRadius: 10, border: "1px solid var(--border)", background: "#0c1426", color: "var(--text)" }}
              />
              <button className="btn" onClick={runSearch} disabled={loading} type="button">Search</button>
            </div>
            {error && <div style={{ color: "#ffb3b3", marginBottom: 8 }}>Error: {error}</div>}

            <h3 style={{ marginTop: 16 }}>Quick Summary</h3>
            {selected ? (
              <div className="muted" style={{ whiteSpace: "pre-wrap" }}>{summary || "Summarizing…"}</div>
            ) : (
              <div className="muted">Select a clip to see a contextual blurb.</div>
            )}
            <div style={{ marginTop: 10 }}>
              <details>
                <summary className="muted">Transcript</summary>
                <div style={{ marginTop: 8, maxHeight: 220, overflow: "auto", background: "#0c1426", padding: 10, borderRadius: 10, border: "1px solid var(--border)" }}>
                  <div style={{ whiteSpace: "pre-wrap" }}>{transcript || "No transcript available."}</div>
                </div>
              </details>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}


