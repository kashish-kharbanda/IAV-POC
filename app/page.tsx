"use client";
import React, { useCallback, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function RootPage() {
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ itemName: string; itemId: string; usedLLM: boolean } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type === "application/pdf") setFile(f);
  }, []);

  const onBrowse = useCallback(() => inputRef.current?.click(), []);

  const canGenerate = useMemo(() => !!file && !loading, [file, loading]);

  async function generate() {
    setError(null);
    setMarkdown(null);
    setMeta(null);
    if (!file) {
      setError("Please select a PDF file first.");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/hara", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Request failed with ${res.status}`);
      }
      const j = await res.json();
      setMarkdown(j.markdown as string);
      setMeta({ itemName: j.itemName, itemId: j.itemId, usedLLM: !!j.usedLLM });
    } catch (err: any) {
      setError(err?.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard() {
    if (!markdown) return;
    await navigator.clipboard.writeText(markdown);
  }

  function downloadMarkdown() {
    if (!markdown) return;
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const name = meta?.itemName?.replace(/[^a-z0-9-_]+/gi, "_") || "LKAS_G2_0";
    a.download = `${name}_HARA_Report.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main>
      <div className="container">
        <div className="header">
          <div className="brand"><div className="logo" /> Phase 3 HARA Generator Agent</div>
          <div className="badge">Concept Phase · ISO 26262</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
          <section className="card">
            <h2>Upload Item Definition</h2>
            <p className="muted">Upload a PDF containing the item definition and functional description.</p>

            <div
              className={`dropzone ${drag ? "drag" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={onDrop}
            >
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                style={{ display: "none" }}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              {file ? (
                <div style={{ marginBottom: 8, textAlign: "left" }}>
                  Selected: <strong>{file.name}</strong>
                </div>
              ) : (
                <div style={{ marginBottom: 8 }}>
                  {"Drag and drop PDF here or browse"}
                </div>
              )}
              <div className="actions">
                <button className="btn secondary" onClick={onBrowse} type="button">Browse</button>
                <button className="btn" onClick={generate} disabled={!canGenerate} type="button">{loading ? "Generating..." : "Generate HARA"}</button>
                {file && <button className="btn danger" onClick={() => setFile(null)} type="button">Clear</button>}
              </div>
            </div>

            {error && (
              <div style={{ marginTop: 12, color: "#ffb3b3" }}>
                <strong>Error:</strong> {error}
              </div>
            )}

            {false && meta && (
              <div style={{ marginTop: 12 }} className="muted"></div>
            )}
          </section>

          <section className="card">
            <h2>Report Output</h2>
            <p className="muted">{`A single, structured HARA report for ${meta?.itemName || "the uploaded item"} in Markdown format.`}</p>
            <div className="actions" style={{ marginBottom: 8 }}>
              <button className="btn secondary" onClick={copyToClipboard} disabled={!markdown} type="button">Copy Markdown</button>
              <button className="btn" onClick={downloadMarkdown} disabled={!markdown} type="button">Download .md</button>
            </div>
            <div className="markdown">
              {markdown ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
              ) : (
                <div className="muted">No report yet. Upload a PDF and click Generate.</div>
              )}
            </div>
          </section>
        </div>

        <div className="footer">
          <span className="muted">© {new Date().getFullYear()} IAV Demo POC</span>
        </div>
      </div>
    </main>
  );
}
