import OpenAI from "openai";
import { z } from "zod";
import type { HaraRow, Severity, Exposure, Controllability } from "./asil";

function getOpenAI(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const baseURL = process.env.OPENAI_BASE_URL; // optional (Azure/OpenRouter/self-hosted proxy)
  const client = new OpenAI({ apiKey, baseURL });
  return client;
}

function pickModels(): string[] {
  const preferred = process.env.OPENAI_MODEL;
  const candidates = [
    preferred,
    "gpt-4o",
    "gpt-4o-mini",
  ].filter(Boolean) as string[];
  return Array.from(new Set(candidates));
}

export async function summarizeItemFromPdfText(text: string): Promise<string | null> {
  const client = getOpenAI();
  if (!client) return null;
  const models = pickModels();
  const prompt = [
    "You are an ISO 26262 safety engineer.",
    "Summarize the item definition and functional description from the following PDF text.",
    "Focus on: purpose, system context, key functions, operating domain, dependencies, and any safety-relevant constraints.",
    "Return 5-8 concise bullet points only.",
  ].join(" ");

  const input = `${prompt}\n\nPDF Text:\n\n${text.slice(0, 12000)}`; // keep token usage in check

  for (const model of models) {
    try {
      const res = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: input },
        ],
        temperature: 0.15,
        max_tokens: 2000,
      });
      const content = res.choices?.[0]?.message?.content?.trim();
      if (content) return content;
    } catch (e: any) {
      // try next model on 404/not found
      if (e?.status !== 404) throw e;
    }
  }
  return null;
}

const HazardSchema = z.object({
  id: z.string().min(1).max(40),
  malfunctionBehavior: z.string().min(3),
  operationalSituation: z.string().min(3),
  hazardDescription: z.string().min(3),
  s: z.number().int().min(0).max(3) as unknown as z.ZodType<Severity>,
  e: z.number().int().min(0).max(4) as unknown as z.ZodType<Exposure>,
  c: z.number().int().min(0).max(3) as unknown as z.ZodType<Controllability>,
  safetyGoal: z.string().min(3),
});

export type ProposedHazard = z.infer<typeof HazardSchema>;

export async function proposeAdditionalHazards(text: string): Promise<ProposedHazard[] | null> {
  const client = getOpenAI();
  if (!client) return null;
  const models = pickModels();

  const system = [
    "You are an ISO 26262 safety engineer specializing in HARA for LKAS systems.",
    "Propose additional hazardous events beyond the three canonical examples.",
    "Output must be STRICT JSON array only. No markdown, no commentary.",
    "Fields: id, malfunctionBehavior, operationalSituation, hazardDescription, s, e, c, safetyGoal.",
    "IDs should be unique and follow the pattern H-AI-###.",
    "s in [0..3], e in [0..4], c in [0..3].",
    "Ensure the proposals are grounded in the PDF text (domain, functions, ODD).",
  ].join(" ");

  const user = `PDF Text (truncated):\n\n${text.slice(0, 20000)}`;

  for (const model of models) {
    try {
      const res = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      });
      const content = res.choices?.[0]?.message?.content?.trim();
      if (!content) continue;
      let raw: unknown;
      try { raw = JSON.parse(content); } catch { continue; }
      let arr: unknown = raw;
      if (raw && typeof raw === "object" && Array.isArray((raw as any).items)) {
        arr = (raw as any).items;
      }
      if (!Array.isArray(arr)) continue;
      const parsed: ProposedHazard[] = [];
      for (const item of arr) {
        const resItem = HazardSchema.safeParse(item);
        if (resItem.success) parsed.push(resItem.data);
      }
      if (parsed.length) return parsed;
    } catch (e: any) {
      if (e?.status !== 404) throw e;
    }
  }
  return null;
}

const ItemMetaSchema = z.object({
  itemName: z.string().min(2),
  itemId: z.string().min(1).optional().default("N/A"),
});

export type LlmItemMeta = z.infer<typeof ItemMetaSchema>;

export async function extractItemMetadataLLM(text: string): Promise<LlmItemMeta | null> {
  const client = getOpenAI();
  if (!client) return null;
  const models = pickModels();
  const system = [
    "Extract the Item Name and Item ID from the following automotive Item Definition text.",
    "If Item ID is not explicitly present, return 'N/A'.",
    "Return STRICT JSON with keys: itemName, itemId.",
  ].join(" ");
  const user = `TEXT (truncated):\n\n${text.slice(0, 16000)}`;

  for (const model of models) {
    try {
      const res = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: "json_object" },
      });
      const content = res.choices?.[0]?.message?.content?.trim();
      if (!content) continue;
      let obj: unknown;
      try { obj = JSON.parse(content); } catch { continue; }
      const parsed = ItemMetaSchema.safeParse(obj);
      if (parsed.success) return parsed.data;
    } catch (e: any) {
      if (e?.status !== 404) throw e;
    }
  }
  return null;
}


