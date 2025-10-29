import { createRequire } from "module";

export async function extractPdfTextFromBuffer(buffer: Buffer): Promise<string> {
  const require = createRequire(import.meta.url);
  // pdf2json is CJS; load via require for compatibility
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const PDFParser = require("pdf2json");

  return await new Promise<string>((resolve, reject) => {
    try {
      const parser = new PDFParser();
      parser.on("pdfParser_dataError", (err: any) => reject(err?.parserError || err));
      parser.on("pdfParser_dataReady", (pdfData: any) => {
        try {
          const texts: string[] = [];
          for (const page of pdfData?.formImage?.Pages || []) {
            for (const textObj of page.Texts || []) {
              for (const r of textObj.R || []) {
                const str = decodeURIComponent(r.T || "");
                if (str) texts.push(str);
              }
            }
            texts.push("\n\n");
          }
          resolve(texts.join(" "));
        } catch (e) {
          reject(e);
        }
      });
      parser.parseBuffer(buffer);
    } catch (e) {
      reject(e);
    }
  });
}

export function extractItemMetadata(text: string): { itemName: string; itemId: string } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const joined = lines.join("\n");

  // Primary labeled patterns
  const nameMatch = joined.match(/(?:Item\s*Name|System\s*Name|Product)\s*[:\-]?\s*(.+)/i);
  const idMatch = joined.match(/(?:Item\s*ID|System\s*ID|Part\s*Number|Doc\s*ID)\s*[:\-]\s*([A-Za-z0-9_.\-]+)/i);

  let itemName = (nameMatch && nameMatch[1]?.trim()) || "";
  let itemId = (idMatch && idMatch[1]?.trim()) || "";

  const GENERIC = [
    /^item\s*definition$/i,
    /^functional\s*description$/i,
    /^system\s*overview$/i,
    /^introduction$/i,
    /^table\s*of\s*contents$/i,
    /^document(\s+.*)?$/i,
    /^contents$/i,
    /^abstract$/i,
    /^scope$/i,
    /^purpose$/i,
    /^requirements?$/i,
  ];
  const isGeneric = (s: string) => GENERIC.some((r) => r.test(s.trim()));

  // Heuristic: if no explicit label, try early lines for a plausible title
  if (!itemName) {
    const candidates = lines.slice(0, 80);
    // Prefer lines with acronym in parentheses, e.g., "Advanced Driver Assistance Module (ADAM)"
    let title = candidates.find((l) => /\([A-Z0-9]{2,}\)/.test(l) && l.length >= 12 && !isGeneric(l));
    if (!title) {
      title = candidates.find((l) => /module|system|assistance|driver|lane|steer|control|steering/i.test(l) && l.length >= 12 && !isGeneric(l));
    }
    if (title) itemName = title;
  }
  // Combine adjacent lines if the second line contains an acronym, e.g., "... Assistance" + "Module (ADAM)"
  if (!itemName) {
    for (let i = 1; i < Math.min(lines.length, 120); i++) {
      const prev = lines[i - 1];
      const curr = lines[i];
      if (/\([A-Z0-9]{2,}\)/.test(curr) && !isGeneric(curr)) {
        const candidate = `${prev} ${curr}`.trim();
        if (candidate.length >= 12 && !isGeneric(candidate)) {
          itemName = candidate;
          break;
        }
      }
    }
  }
  if (!itemName && lines.length) itemName = lines[0];
  if (itemName && isGeneric(itemName)) itemName = "";

  return { itemName: itemName || "LKAS G2.0", itemId: itemId || "N/A" };
}


