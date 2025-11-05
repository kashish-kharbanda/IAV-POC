"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
pdfjs.GlobalWorkerOptions.workerSrc = `/api/pdf-worker?ver=${pdfjs.version}`;

export type PdfViewProps = { file: File; highlightRegex?: RegExp; onError?: (msg: string) => void; width?: number };

export function PdfView(props: PdfViewProps) {
  const { file, highlightRegex, onError, width } = props;
  const [numPages, setNumPages] = useState<number>(0);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [pageRects, setPageRects] = useState<Array<Array<{ left: number; top: number; width: number; height: number }>>>([]);

  const computeHighlightRects = useCallback((idx: number) => {
    const root = pageRefs.current[idx];
    if (!root || !highlightRegex) return;
    const textLayer = root.querySelector<HTMLDivElement>(".react-pdf__Page__textContent");
    if (!textLayer) return;
    const spans = textLayer.querySelectorAll<HTMLSpanElement>("span");
    const re = new RegExp(highlightRegex.source, highlightRegex.flags);
    const containerBox = root.getBoundingClientRect();
    const rects: Array<{ left: number; top: number; width: number; height: number }> = [];
    spans.forEach((span) => {
      const txt = span.textContent || "";
      if (!txt) return;
      re.lastIndex = 0;
      if (!re.test(txt)) return;
      const box = span.getBoundingClientRect();
      rects.push({
        left: box.left - containerBox.left,
        top: box.top - containerBox.top,
        width: box.width,
        height: box.height,
      });
    });
    setPageRects((prev) => {
      const next = prev.slice();
      next[idx] = rects;
      return next;
    });
  }, [highlightRegex]);

  useEffect(() => {
    // Reset rects when file changes
    setPageRects([]);
  }, [file]);

  return (
    <Document
      file={file}
      onLoadSuccess={({ numPages }: { numPages: number }) => {
        setNumPages(numPages || 0);
        // Initialize rects storage for each page
        setPageRects(Array.from({ length: numPages || 0 }, () => []));
      }}
      onLoadError={(e: unknown) => onError?.((e as any)?.message || "Failed to load PDF")}
    >
      {Array.from({ length: numPages || 0 }).map((_, i) => (
        <div
          key={i}
          className="pdf-page"
          ref={(el) => {
            pageRefs.current[i] = el;
          }}
          style={{ position: "relative" }}
        >
          <Page
            pageNumber={i + 1}
            renderAnnotationLayer={false}
            renderTextLayer
            onRenderSuccess={() => {
              // Ensure layout settled before reading boxes
              requestAnimationFrame(() => computeHighlightRects(i));
            }}
            onGetTextSuccess={() => {
              requestAnimationFrame(() => computeHighlightRects(i));
            }}
            width={width ?? 800}
          />
          {pageRects[i] && pageRects[i].length > 0 && (
            <div className="pdf-highlights">
              {pageRects[i].map((r, k) => (
                <div key={k} className="pdf-highlight-box" style={{ left: r.left, top: r.top, width: r.width, height: r.height }} />
              ))}
            </div>
          )}
        </div>
      ))}
    </Document>
  );
}

export default PdfView;


