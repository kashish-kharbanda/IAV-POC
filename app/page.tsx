"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import dynamic from "next/dynamic";
import type { PdfViewProps } from "./PdfView";

const PdfViewClient = dynamic<PdfViewProps>(() => import("./PdfView"), { ssr: false });

export default function RootPage() {
  const [tab, setTab] = useState<"HARA" | "Traceability" | "Audits" | "Safety Case">("HARA");
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ itemName: string; itemId: string; usedLLM: boolean } | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string>("");
  const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "saved" | "error" | "submitting">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type === "application/pdf") {
      setFile(f);
      void extractQuickSummary(f);
    }
  }, []);

  const onBrowse = useCallback(() => inputRef.current?.click(), []);

  const canGenerate = useMemo(() => !!file && !loading, [file, loading]);

  // Highlight terms in PDF
  const highlightRegex = useMemo(() => {
    const terms = [
      "Item\\s*Name", "System\\s*Name", "Product",
      "Item\\s*ID", "System\\s*ID", "Part\\s*Number", "Doc\\s*ID",
      "Item\\s*Definition", "Functional\\s*Description", "System\\s*Overview",
      "Operating\\s*Design\\s*Domain", "ODD",
      "Hazard", "Malfunction", "Safety\\s*Goal", "ASIL", "Controllability", "Exposure", "Severity"
    ];
    return new RegExp(`(${terms.join("|")})`, "gi");
  }, []);

  async function generate() {
    setError(null);
    setMarkdown(null);
    setMeta(null);
    if (!file) { setError("Please select a PDF file first."); return; }
    setLoading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/hara", { method: "POST", body: fd });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `Request failed with ${res.status}`); }
      const j = await res.json();
      setMarkdown(j.markdown as string);
      setMeta({ itemName: j.itemName, itemId: j.itemId, usedLLM: !!j.usedLLM });
    } catch (err: any) { setError(err?.message || "Unexpected error"); } finally { setLoading(false); }
  }

  async function copyToClipboard() { if (!markdown) return; await navigator.clipboard.writeText(markdown); }
  function exportAsPdf() { if (!markdown) return; window.print(); }
  function downloadMarkdown() {
    if (!markdown) return; const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url;
    const name = meta?.itemName?.replace(/[^a-z0-9-_]+/gi, "_") || "LKAS_G2_0"; a.download = `${name}_HARA_Report.md`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  // Quick Summary
  const summaryBullets = useMemo(() => {
    if (!summary) return [] as string[]; const s = summary.replace(/\s+/g, " ").trim(); if (!s) return [] as string[];
    let parts = s.split(/(?<=[.!?])\s+/).map((p) => p.trim()).filter((p) => p.length >= 3);
    if (parts.length < 3) { parts = s.split(/\u2022|\u2013|\u2014|;| - |\n|,\s+/).map((p) => p.trim()).filter((p) => p.length >= 3); }
    const filtered = parts.filter((p) => { const t = p.toLowerCase(); if (/^product\s*desc(ription)?\b/.test(t)) return false; if (/\bproduct\s*description\b/.test(t)) return false; if (/^description\b/.test(t)) return false; return true; });
    const shorten = (text: string) => { let t = text.replace(/\s*\([^)]*\)/g, ""); t = t.split(/\s+[-–—;:]\s+/)[0] || t; const words = t.split(/\s+/).filter(Boolean).slice(0, 18); t = words.join(" "); t = t.replace(/\s+\./g, "."); if (!/[.!?]$/.test(t)) t = t + "."; return t; };
    return filtered.slice(0, 6).map(shorten);
  }, [summary]);

  async function extractQuickSummary(f: File) {
    try {
      setSummaryLoading(true); setSummary(null);
      const { pdfjs } = await import("react-pdf"); pdfjs.GlobalWorkerOptions.workerSrc = `/api/pdf-worker?ver=${pdfjs.version}`;
      const ab = await f.arrayBuffer(); const task = pdfjs.getDocument({ data: ab }); const doc = await task.promise; const page = await doc.getPage(1);
      const textContent: any = await page.getTextContent();
      const text = (textContent.items || []).map((it: any) => (typeof it?.str === "string" ? it.str : "")).join(" ").replace(/\s+/g, " ").trim();
      const snippet = text.slice(0, 600); setSummary(snippet || null);
    } catch { setSummary(null); } finally { setSummaryLoading(false); }
  }

  useEffect(() => {
    const key = meta?.itemId || meta?.itemName; if (!key) return; try { const saved = localStorage.getItem(`feedback:${key}`); setFeedback(saved || ""); setFeedbackStatus("idle"); } catch {}
  }, [meta?.itemId, meta?.itemName]);
  function saveFeedback() {
    if (!meta) return; setFeedbackStatus("submitting"); try { const key = meta.itemId || meta.itemName; localStorage.setItem(`feedback:${key}`, feedback); setFeedbackStatus("saved"); setTimeout(() => setFeedbackStatus("idle"), 1500); } catch { setFeedbackStatus("error"); setTimeout(() => setFeedbackStatus("idle"), 1500); }
  }

  async function loadRecent() {
    try {
      const res = await fetch("/api/recent-pdf"); if (!res.ok) throw new Error("Failed to load recent PDF");
      const blob = await res.blob(); const recent = new File([blob], "LKAS_G2.0_Item_Definition.pdf", { type: "application/pdf" });
      setFile(recent); void extractQuickSummary(recent);
    } catch (e) { setError((e as any)?.message || "Failed to load recent PDF"); }
  }

  return (
    <main>
      <div className="container">
        <div className="header">
          <div className="brand"><div className="logo" /> IAV ISOSO 2626</div>
          <div className="badge">Concept Phase · ISO 26262</div>
        </div>
        <nav className="tabs">
          {["HARA", "Traceability", "Audits", "Safety Case"].map((t) => (
            <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t as any)} type="button">{t}</button>
          ))}
        </nav>

        {tab === "HARA" && (
          <>
          <div style={{ display: "grid", gridTemplateColumns: file ? "0.9fr 1.1fr" : "1fr", gap: 20, alignItems: "start" }}>
            <section className="card">
              <h2>Upload Item Definition</h2>
              <p className="muted">Upload a PDF containing the item definition and functional description.</p>
              <div className={`dropzone ${drag ? "drag" : ""}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}>
                <input ref={inputRef} type="file" accept="application/pdf" style={{ display: "none" }}
                  onChange={(e) => { const f = e.target.files?.[0] || null; setFile(f); if (f) void extractQuickSummary(f); }} />
                {file ? (<div style={{ marginBottom: 8, textAlign: "left" }}>Selected: <strong>{file.name}</strong></div>) : (<div style={{ marginBottom: 8 }}>Drag and drop PDF here or browse</div>)}
                <div className="actions">
                  <button className="btn secondary" onClick={onBrowse} type="button">Browse</button>
                  <button className="btn" onClick={generate} disabled={!canGenerate} type="button">{loading ? "Generating..." : "Generate HARA"}</button>
                  {file && <button className="btn danger" onClick={() => setFile(null)} type="button">Clear</button>}
                </div>
              </div>
              {error && (<div style={{ marginTop: 12, color: "#ffb3b3" }}><strong>Error:</strong> {error}</div>)}

              {/* Quick Summary */}
              {file && (
                <section className="card" style={{ marginTop: 16 }}>
                  <h3 style={{ marginTop: 0 }}>Quick Summary</h3>
                  {!summary && summaryLoading && (<div className="muted">Reading PDF…</div>)}
                  {summary && summaryBullets.length > 0 && (
                    <ul className="muted" style={{ margin: "8px 0", paddingLeft: 22 }}>
                      {summaryBullets.map((b, i) => (<li key={i} style={{ marginBottom: 8 }}>{b}</li>))}
                    </ul>
                  )}
                  {summary && summaryBullets.length === 0 && (<div className="muted" style={{ whiteSpace: "pre-wrap" }}>{summary}</div>)}
                </section>
              )}

              {/* Recent Documents */}
              <section className="card" style={{ marginTop: 16 }}>
                <h3 style={{ marginTop: 0 }}>Recent Documents</h3>
                <div className="actions"><button className="btn secondary" type="button" onClick={loadRecent}>LKAS G2.0 Item Definition</button></div>
              </section>
            </section>

            {file && (
              <section className="card">
                <h2>PDF Preview</h2>
                <p className="muted">Key sections are highlighted in yellow where detected.</p>
                <div className="pdf-container">
                  <PdfViewClient file={file} highlightRegex={highlightRegex} onError={(m: string) => setError(m)} width={600} />
                </div>
              </section>
            )}
          </div>

          <section className="card" style={{ marginTop: 20 }}>
            <h2>Report Output</h2>
            <p className="muted">{`A single, structured HARA report for ${meta?.itemName || "the uploaded item"} in Markdown format.`}</p>
            <div className="actions" style={{ marginBottom: 8 }}>
              <button className="btn secondary" onClick={copyToClipboard} disabled={!markdown} type="button">Copy Markdown</button>
              <button className="btn" onClick={downloadMarkdown} disabled={!markdown} type="button">Download .md</button>
              <button className="btn" onClick={exportAsPdf} disabled={!markdown} type="button">Export as PDF</button>
            </div>
            <div className="markdown">
              {markdown ? (<ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>) : (<div className="muted">No report yet. Upload a PDF and click Generate.</div>)}
            </div>

            {/* Reviewer Feedback */}
            <div style={{ marginTop: 16 }}>
              <h3 style={{ marginTop: 0 }}>Reviewer Feedback</h3>
              <p className="muted" style={{ marginTop: 0 }}>Leave comments or edits for this report.</p>
              <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Write feedback here..." rows={5}
                style={{ width: "100%", background: "#0e162b", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 10, padding: 10, resize: "vertical" }} disabled={!markdown} />
              <div className="actions" style={{ marginTop: 8 }}>
                <button className="btn" type="button" disabled={!markdown || feedbackStatus === "submitting"} onClick={saveFeedback}>{feedbackStatus === "submitting" ? "Saving..." : "Save Feedback"}</button>
                {feedbackStatus === "saved" && <span className="muted">Saved</span>}
                {feedbackStatus === "error" && <span style={{ color: "#ffb3b3" }}>Failed to save</span>}
              </div>
            </div>
          </section>
          </>
        )}

        {tab === "Traceability" && (
          <section className="card">
            <h2>Traceability</h2>
            <div className="markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{`### Scope and Context
- ODD: Highway lane keeping, clear markings, 0–120 km/h, nominal weather
- Hazards: H-201 Uncommanded steering, H-202 Loss of assistance, H-204 Low-speed activation

### SG ↔ FSR ↔ TSR
| Level | ID | Title / Intent | Links | Status |
| :--- | :--- | :--- | :--- | :--- |
| SG | SG-1 | Prevent unintended steering torque beyond driver intent | H-201 | Approved |
| FSR | FSR-12 | EPS torque limits bounded by driver input | SG-1 | Approved |
| TSR | TSR-34 | Torque limiter clamp curve applied at all speeds | FSR-12 → T-101,T-202 | Tests Passing |
| TSR | TSR-35 | Fault monitor disengage to safe-state ≤50 ms | FSR-12 → T-208 | Tests Passing |
| SG | SG-2 | Indicate loss or degradation of assistance ≤500 ms | H-202 | Approved |
| FSR | FSR-22 | Driver notification latency ≤500 ms | SG-2 | Approved |
| TSR | TSR-41 | HMI warning within bound across ODD | FSR-22 → T-305,T-306 | Gap: rainy ODD test missing |
| SG | SG-3 | Suppress assistance below 10 km/h | H-204 | Approved |
| FSR | FSR-31 | Speed gate enforcement (v < 10 km/h) | SG-3 | Approved |
| TSR | TSR-51 | Inhibit LKAS when v < 10 km/h | FSR-31 → T-402 | Tests Passing |

### V&V Coverage
- Requirements with ≥1 linked passing test: 92%
- Open gap: TSR-41 rainy ODD latency; add T-306 and rerun T-305 after HMI debounce change
- ASIL alignment: SG-1 chain inherits H-201 → ASIL D; reviews complete

### Filters
- TSR with no passing tests
- Artifacts inheriting H-201 (ASIL D)
- Items edited in last 7 days

### Impact Analysis
Tighten FSR-22 from 500 ms → 400 ms
- Affects TSR-41 acceptance and tests T-305,T-306
- Adjust HMI warning debounce to meet 400 ms target
- Tests become Pending until rerun
`}</ReactMarkdown>
            </div>
          </section>
        )}

        {tab === "Audits" && (
          <section className="card">
            <h2>Audit Readiness</h2>
            <div className="markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{`### Evidence Bundle
- HARA: H-201/H-202/H-204 with ASIL D/B/QM; SG-1/2/3
- FSR/TSR: FSR-12/22/31; TSR-34/35/41/51 with approvals and revisions
- V&V: Tests T-101, T-202, T-208, T-305, T-306, T-402 with pass/fail, logs, timestamps
- Change management: impact analysis for FSR-22 latency; sign-offs
- Toolchain: environment and versions

### ISO 26262 Alignment
- Part 3: Item Definition → HARA → SGs
- Parts 4/5/6: FSR/TSR derivation, architecture links, test mapping
- Part 7: Production, operation, service, decommissioning
- Part 8: Documentation, configuration, change management

### Readiness KPIs
- Traceability: 93% complete
- Open gap: TSR-41 rainy ODD latency test
- Approvals: ≤ 48h freshness

### Audit Queries
- Show all ASIL-D artifacts lacking passing tests
- List all changes in last 7 days with downstream impacts
- Export safety case index as CSV/PDF
`}</ReactMarkdown>
            </div>
          </section>
        )}

        {tab === "Safety Case" && (
          <section className="card">
            <h2>Safety Case (LKAS G2.0)</h2>
            <p className="muted">Structured argument and evidence for LKAS G2.0.</p>
            <div className="markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{`### Goal
Show that LKAS G2.0 is acceptably safe for highway lane-keeping within the defined ODD.

### Context
- Item: Lane Keeping Assist System controlling EPS with HMI warnings
- ODD: Highway with clear markings, 0–120 km/h, nominal weather
- Dependencies: Camera/Radar perception, EPS interface, HMI

### Strategy
Satisfy safety goals derived from HARA; ensure traceable implementation (FSR → TSR) and verification (tests), including FTTI for ASIL D paths.

### Sub-goals and Acceptance Criteria
1) SG-1 from H-201 ASIL D: Prevent unintended steering torque beyond driver intent
   - Criteria: torque clamp enforced; fault disengage to safe state ≤ 50 ms; driver input priority
   - Evidence: H-201 ASIL D; FSR-12; TSR-34/35; tests T-101,T-202,T-208

2) SG-2 from H-202 ASIL B: Indicate loss or degradation of assistance ≤ 500 ms
   - Criteria: visual and haptic warning; latency ≤ 500 ms across ODD; event logged
   - Evidence: H-202 ASIL B; FSR-22; TSR-41; tests T-305,T-306 Pending

3) SG-3 from H-204 QM: Suppress assistance at low speed
   - Criteria: inhibit LKAS when v < 10 km/h; no torque > X Nm; no spurious warnings
   - Evidence: H-204 QM; FSR-31; TSR-51; test T-402

### Completeness
- FSR ↔ TSR mapping complete for SG-1/2/3
- Tests cover acceptance for each TSR; logs and timestamps attached
- FTTI verified for SG-1 chain via T-208

### Assumptions and Constraints
- Lane markings detectable in baseline ODD; extended ODD requires additional validation
- EPS torque authority bounded; driver input overrides assist

### Residual Risk and Actions
- Open: rainy ODD latency test T-306 for TSR-41
- Action: add T-306; rerun T-305 after HMI debounce change; update evidence links

### Conclusion
With current evidence and one tracked open item, the Safety Case is ready for internal review; audit bundle can be produced on demand.
`}</ReactMarkdown>
            </div>
          </section>
        )}

        <div className="footer"><span className="muted">© {new Date().getFullYear()} IAV Demo POC</span></div>
      </div>
    </main>
  );
}
