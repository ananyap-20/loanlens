# LoanLens

> **Artificial intelligence is the tool. Real intelligence is the brain.**

📄 **[Read the thinking behind LoanLens (3-page PDF)](docs/LoanLens_Thinking_Behind_It.pdf)**: why it is built this way, consent and privacy, what was researched, and how it differs.

## Note on API access
Registered for the Gnani AI challenge with the email used on the submission form (20ananya.pandey@gmail.com)
Gnani API keys were issued under my institutional account (s23_pandey_ananya@mgmmumbai.ac.in).

**A thumbprint proves who signed. LoanLens proves she understood.**

One-page pitch: see PITCH.md

LoanLens is a voice-first, borrower-side loan understanding check. A loan agent reads the key terms aloud, the app checks what was said against the paper (a KFS PDF or QR code), the borrower explains the loan back in her own words (teach-back), and an understanding gate decides whether to produce a shareable receipt.

> Voice is **not** a legal signature. The receipt is "proof of understanding, alongside the signature". It is not a loan approval and not a verdict on any lender.

Live demo: https://loanlens-mauve.vercel.app

## Gnani AI models used

| Role | Model | Where |
|---|---|---|
| Speech-to-text | **Gnani Prisma** (`prisma-v3.0`, Hindi + English, `format=transcribe`, keyterms; v2.5 fallback) | `app/api/transcribe/route.ts` |
| Text-to-speech | **Gnani Timbre** (`timbre-v2.5`) | `app/api/speak/route.ts` |

No other AI/ML model is used: no OCR, no third-party LLM, no browser speech recognition, no face or voice biometrics.

**Fixed sample narration** (welcome, instructions, the sample paper's explanation and the agent's check questions) is pre-generated with real Timbre calls and stored in `public/audio` for instant playback. A clip plays only when the exact text and voice match; everything else is spoken live through Timbre. All speech recognition is live Prisma.

## How decisions are made

Every extraction, comparison and verdict is a **deterministic TypeScript rule** with unit tests (`lib/engine/`). No LLM decides anything.

- Unknown stays unknown; a missing value is never treated as 0.
- Only equivalent fields (same unit and frequency) are compared; otherwise the result is "couldn't check".
- Outputs are *matched / different / not mentioned / couldn't check* plus the question to ask the lender. The app never says "safe", "approved", "verified" or "fraud".

## Features

- In-person flow: agent reads terms, field-by-field check against the paper, borrower teach-back, understanding gate, shared PDF receipt.
- Online flow: share the lender's KFS PDF or scan a QR code.
- Call check (`/call`): a synthetic sample call is transcribed and its promises are compared with the paper.
- Languages: Hindi, English, Marathi (Marathi wording under review). Other Gnani languages are marked Beta and not yet enabled.
- Zero-reading UX: spoken instructions, replay and slow buttons, colour + icon + sound for every status, no typing.
- Privacy: nothing recorded in the background, a "clear everything" button, no database, no login.

## Data

All data is **synthetic**: a fictional lender ("Sahyog Finance (fictional)") and fictional borrower. No real phone, account, Aadhaar or PAN numbers and no real recorded calls.

## Run locally

```bash
npm install
# create .env.local in the project root with your key:
# GNANI_API_KEY=your_key_here
npm run dev
npm test
npm run build
```

`GNANI_API_KEY` is read only on the server (`lib/gnani/server.ts`), is never exposed to the browser, and `.env*` is gitignored.

## Tech

Next.js (App Router), TypeScript, Tailwind, vitest, `pdfjs-dist` (text-based PDFs), `jsqr` (QR), `pdf-lib` (receipt), Web Audio API (16 kHz mono WAV recording and playback), Web Crypto (SHA-256 fingerprints). Deployed on Vercel.

## Evaluation

`npm run eval -- --server <url>` runs your own recorded clips (kept local in `eval/clips`) through the live Prisma endpoint and writes a report to `eval/out`.
