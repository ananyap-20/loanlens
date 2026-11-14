# Arth · अर्थ

**Arth: know what it means before you sign.**

**A thumbprint proves who signed. Arth checks that the borrower understood.**

> **Artificial intelligence is the tool. Real intelligence is the brain.**

*Arth, from the Sanskrit artha: meaning, and wealth.*

अर्थ · अर्थम् · অর্থ · અર્થ

📄 Read [the thinking behind Arth (PDF, written under the earlier working name LoanLens)](docs/LoanLens_Thinking_Behind_It.pdf): why it is built this way, consent and privacy, what was researched, and how it differs. There is also [the one-page pitch (PDF, written under the earlier working name LoanLens)](LoanLens_Pitch.pdf) and its text version, [PITCH.md](PITCH.md).

> Voice is **not** a legal signature. The receipt is **proof of understanding, alongside the signature**. It is not a signature, not a loan approval, and not a verdict on any lender.

## Watch the 90-second walkthrough

▶️ Walkthrough video: **[link to be added]** <!-- WALKTHROUGH_VIDEO_LINK: paste here -->

## Try it in 60 seconds

1. Open **https://loanlens-mauve.vercel.app** on a phone (Chrome on Android works best), with the sound on.
2. Tap **शुरू करें** (Start), then **1 · सिर्फ़ मैं** (only me).
3. Tap **3 · नमूना** (Sample) to load the built-in sample paper.
4. Follow the spoken instructions. Every screen speaks; 🔁 replays it and 🐢 plays it slower.

The sample paper is synthetic: a fictional lender ("Sahyog Finance (fictional)") and fictional terms.

## Screenshots

<p>
  <img src="docs/screens/01-welcome.png" alt="Welcome screen: the Arth wordmark, language picker and Start button" width="180" />
  <img src="docs/screens/02-explain.png" alt="The sample paper explained as picture cards with notes and coins" width="180" />
  <img src="docs/screens/03-agent-conflict.png" alt="Agent check: the agent said no processing fee, the paper says ₹1,500, shown as ❌ different" width="180" />
  <img src="docs/screens/04-teachback.png" alt="Teach-back: the borrower explains the loan in their own words" width="180" />
  <img src="docs/screens/05-result.png" alt="Result: what matched, what was different, questions to ask the lender and where to complain" width="180" />
  <img src="docs/screens/06-receipt.png" alt="Receipt: PDF pages and the receipt fingerprint, ready to share" width="180" />
</p>

## How it works

**Three doors, one deterministic engine.**

- 🏠 **In person:** the agent records a spoken consent line, then reads the key terms aloud one by one. Each spoken term is compared with the paper. Then the borrower explains the loan back in their own words (teach-back): money in hand, instalment, fee, and what happens after a missed instalment. Questions come in random order. The check passes only when every answer matches the paper; after three different answers on one point the app says: do not sign yet, bring someone you trust.
- 📱 **Online:** the borrower shares the lender's Key Facts Statement (KFS) PDF, or scans a QR code on it, and gets the same explanation and teach-back.
- 📞 **Call check** (`/call`, synthetic sample only): a synthetic sales call is transcribed and its promises are compared with the paper.

Every result is one of **matched / different / not mentioned / couldn't check**, always shown as colour + icon + sound, together with the question to ask the lender and where to complain (the lender's grievance officer named on the KFS, then the RBI complaint portal, cms.rbi.org.in). The app never gives a verdict on a loan or a lender.

**No LLM decides anything.** Reading the paper, pulling numbers out of speech, comparing them and the teach-back check are all deterministic TypeScript rules with unit tests (`lib/engine/`). Unknown stays unknown; a missing value is never treated as 0. Only like-for-like fields (same unit and frequency) are compared; anything else is "couldn't check".

**Only Gnani AI models.**

| Role | Model | Where |
|---|---|---|
| Speech-to-text | **Gnani Prisma** (`prisma-v3.0`, `format=transcribe`, loan keyterms; v2.5 fallback) | `app/api/transcribe/route.ts` |
| Text-to-speech | **Gnani Timbre** (`timbre-v2.5`; Hindi Nalini / Deepak, English Kaveri / Pranav, Marathi Zahira / Ishaan) | `app/api/speak/route.ts` |

No other AI or ML model is used: no OCR, no third-party LLM, no browser speech recognition, no face or voice biometrics, no voice cloning. Ordinary non-AI libraries do the rest (`pdfjs-dist` for text-based PDFs, `jsqr` for QR codes, `pdf-lib` for the receipt).

The fixed prompts (welcome, instructions, the sample paper's explanation and the agent's check questions) were generated once with real Timbre calls and are stored in `public/audio`. A stored clip plays only when the exact text and voice match; everything else is spoken live through Timbre. All speech recognition is live Prisma.

## Languages

| Language | Status |
|---|---|
| Hindi | Stable |
| English | Stable |
| Marathi | Wording under review (shown with a review tag) |
| Bengali, Gujarati, Kannada, Malayalam, Punjabi, Tamil, Telugu | **Beta**: listed with a Beta tag, not selectable yet; wording not reviewed by a native speaker |

## Limitations

- Voice is not a legal signature, and the app does not prove whose voice it heard. Another person can speak for the borrower.
- The check covers only the listed fields (loan amount, amount in hand, instalment and how often, processing fee, tenure, late fee). Anything else on the paper is not checked.
- Accuracy has not been measured at scale. No accuracy figure is claimed.
- Beta languages may mislead: their wording has not been reviewed by a native speaker, which is why they cannot be selected yet.
- Synthetic data only: a fictional lender, fictional names, no real phone, account, Aadhaar or PAN numbers, and no real recorded calls.
- Speech-to-text can mishear digits. When a number is unclear or implausible, the app asks again instead of guessing.
- An agent and a borrower who work together to fool the check are out of scope.

## Notes on Gnani's APIs

What we ran into while building this project:

- **Prisma accepts at most 30 s of audio per request.** The app stops a clip at 28 s, and the call check splits a call into pieces of at most 28 s.
- **Prisma detects the audio format from the file name extension**, so the app always uploads the clip as `clip.wav`.
- **The browser's own recording format (WebM) is not accepted**, so the app records with the Web Audio API and encodes 16 kHz mono 16-bit WAV itself.
- **Prisma v3.0 with `format=transcribe` returns numbers as digits and keeps English loan words in Latin script.** Spoken "Aapko tees hazaar ka loan milega, EMI do hazaar chhe sau chhiyasath, aur processing fee nahi lagegi" came back as `आपको 30,000 का loan मिलेगा। EMI 2666 और processing fee नहीं लगेगी।` (kept as a test fixture).
- **Only one active request at a time.** Gnani can answer 429 when a second request overlaps, so every Prisma and Timbre call goes through one client-side queue, one at a time, with exponential backoff on Gnani's 429.
- **Timbre needs numbers written as spoken words** ("पंद्रह सौ रुपये", not "₹1,500"), so every spoken amount is converted to words first.
- **Static prompts are cached**: pre-generated clips for the fixed prompts, and an in-memory cache for anything already spoken in the session.

## Privacy and safety

- Nothing is recorded in the background. Recording starts only on a tap and is always shown on screen (a red "recording" pill with a timer).
- The agent records a spoken consent line before anything about the loan is recorded.
- One big button clears everything from the session. There is no database and no login.
- `GNANI_API_KEY` is read only on the server (`lib/gnani/server.ts`), is never sent to the browser, and `.env*` is gitignored. The API routes do not log audio, text or request bodies.
- The two API routes have a best-effort per-IP rate limit (60 requests per 5 minutes each), a 2 MB cap on uploaded audio and a 600-character cap on text to speak.

## Run locally

```bash
npm install
# create .env.local in the project root with your key:
# GNANI_API_KEY=your_key_here
npm run dev
npm test
npm run build
```

## Tests

`npm test` runs **538 tests** (29 files, all passing at the time of writing): number parsing in Hindi, Hinglish and Devanagari words, the fee conflict (₹1,500 vs "nahi"), missing values staying "not mentioned", weekly vs monthly as "couldn't check", the teach-back check, paper reading, the receipt, the request queue and the API route limits.

## Eval

`npm run eval -- --server <url>` sends your own recorded synthetic clips (kept locally in `eval/clips`, never committed) through the live Prisma endpoint, scores them with the engine and writes a report to `eval/out`. It needs a running server with a Gnani API key and spends one Prisma call per new clip.

Latest result: **[eval result to be added]** <!-- EVAL_RESULT: paste the real one-line summary from `npm run eval` here -->

## Tech

Next.js (App Router), TypeScript, Tailwind CSS, vitest, `pdfjs-dist`, `jsqr`, `pdf-lib`, Web Audio API (recording and playback), Web Crypto (SHA-256 fingerprints), Poppins and Noto Sans fonts. Deployed on Vercel.
