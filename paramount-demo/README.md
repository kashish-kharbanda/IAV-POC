# Paramount Demo — Video Intelligence (Next.js)

Search YouTube via SerpAPI, select a clip, auto-summarize transcript, and detect likely product placements using on-device object detection (coco-ssd) on the clip thumbnail.

## Setup

1) Install deps
```bash
npm install
```

2) Env
- Set `SERPAPI_API_KEY` in Vercel (Project → Settings → Environment Variables) or locally:
```bash
export SERPAPI_API_KEY=YOUR_KEY
```

3) Dev
```bash
npm run dev
```
Open http://localhost:3000

## Features
- SerpAPI YouTube search (`/api/search`) to list candidate clips
- Transcript fetch (`/api/transcript`) using `youtube-transcript`
- Quick contextual blurb (extractive summary)
- Product placement detection (bottle/cup/etc.) on thumbnail using `@tensorflow-models/coco-ssd`

## Deploy (Vercel)
```bash
vercel link --yes --project paramount-demo
vercel deploy --prod
```

## Notes
- Thumbnail detection is used for demo feasibility (cross-origin video frames are restricted). For full-frame detection, sample frames from a playable source and run the same model per frame.
- Replace summarization with LLM if desired by adding an API route that calls your model of choice.


