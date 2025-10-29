import { NextRequest, NextResponse } from "next/server";
import { extractPdfTextFromBuffer, extractItemMetadata } from "../../../lib/pdf";
import { renderHaraMarkdown, defaultLkasRows, calculateAsil } from "../../../lib/asil";
import type { HaraRow } from "../../../lib/asil";
import { summarizeItemFromPdfText, proposeAdditionalHazards, extractItemMetadataLLM } from "../../../lib/llm";
import { hardcodedLkasReport } from "../../../lib/hardcoded";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing 'file' in form-data" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const originalFileName = typeof file.name === "string" ? file.name : "uploaded_item.pdf";

    const text = await extractPdfTextFromBuffer(buffer);
    let { itemName, itemId } = extractItemMetadata(text);

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
    const isWeakName = (s?: string | null) => {
      if (!s) return true;
      const t = s.trim();
      if (!t || t === "N/A") return true;
      if (t.length < 6) return true;
      if (GENERIC.some((r) => r.test(t))) return true;
      return false;
    };

    // Optional LLM summarization and hazard proposals (null if no key)
    const [summary, proposed] = await Promise.all([
      summarizeItemFromPdfText(text),
      proposeAdditionalHazards(text),
    ]);

    // If the name/ID look weak, try LLM extraction
    if (isWeakName(itemName) || !itemId || itemId === "N/A") {
      const llmMeta = await extractItemMetadataLLM(text);
      if (llmMeta?.itemName) itemName = llmMeta.itemName;
      if (llmMeta?.itemId) itemId = llmMeta.itemId;
    }

    // Final normalization fallback: use cleaned file name as item name if still missing or N/A
    if (isWeakName(itemName)) {
      const stripped = originalFileName.replace(/\.[^./\\]+$/, "");
      itemName = stripped.replace(/[._-]+/g, " ").trim() || "Uploaded Item";
    }

    // Combine fixed LKAS examples with LLM-proposed hazards
    const baseRows = defaultLkasRows();
    const combined: HaraRow[] = [...baseRows];
    if (proposed && proposed.length > 0) {
      for (const p of proposed) {
        const exists = combined.some(
          (r) => r.id === p.id || r.malfunctionBehavior.toLowerCase() === p.malfunctionBehavior.toLowerCase()
        );
        if (exists) continue;
        const asil = calculateAsil(p.s, p.e, p.c);
        combined.push({ ...p, asil });
      }
    }

    // FOR NOW: return a hardcoded LKAS HARA report framework per user request
    const hard = hardcodedLkasReport();
    return NextResponse.json({ markdown: hard.markdown, itemName: hard.itemName, itemId: hard.itemId, usedLLM: false });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unexpected error" }, { status: 500 });
  }
}


