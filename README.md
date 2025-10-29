## LKAS HARA Builder (Next.js)

A Next.js app to upload an Item Definition PDF, extract text, and generate a single Markdown HARA report titled "LKAS G2.0 HARA Report". Optional LLM summarization improves context.

### Quick Start

1. Install deps: `npm install`
2. Optional LLM: copy `.env.example` to `.env.local` and set keys
3. Dev: `npm run dev` → open http://localhost:3000

### How it works

- `app/api/hara/route.ts`: parses PDF, extracts metadata, optional LLM summary, returns Markdown
- `lib/pdf.ts`: PDF text + item metadata extraction
- `lib/asil.ts`: ASIL heuristic + matrix + Markdown rendering
- `lib/llm.ts`: OpenAI-compatible wrapper (skips if no API key)
- `app/page.tsx`: upload UI and Markdown rendering

### Env (.env.local)

```
OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_MODEL=gpt-4o-mini
```

### Notes

- Ensures requested LKAS examples map to: D (H-201), B (H-202), QM (H-203)
- Replace ASIL heuristic with your approved mapping if needed

## Deploy

### 1) Push to GitHub

Initialize git and push to a new GitHub repo (replace placeholders):

```bash
git init
git add .
git commit -m "init: LKAS HARA Builder"
git branch -M main
git remote add origin https://github.com/<your-org-or-user>/<repo-name>.git
git push -u origin main
```

### 2) Deploy to Vercel (Dashboard)

1. Go to https://vercel.com → New Project → Import Git Repository
2. Select your repo and accept auto-detected Next.js settings
3. Set Environment Variables (optional but recommended):
   - `OPENAI_API_KEY`
   - `OPENAI_BASE_URL` (if using Azure/OpenRouter/proxy)
   - `OPENAI_MODEL` (e.g., `gpt-4o` or `gpt-4o-mini`)
4. Deploy

The API route `app/api/hara/route.ts` is explicitly set to the Node.js runtime and should work on Vercel’s serverless functions.

### 3) Deploy via Vercel CLI (optional)

```bash
npm i -g vercel
vercel login
vercel link     # or `vercel` and follow prompts
vercel --prod
```


