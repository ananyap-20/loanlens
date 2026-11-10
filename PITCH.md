# LoanLens: one-page pitch

**A thumbprint proves who signed. LoanLens checks that the borrower understood, by voice, before she signs.**

**Live app:** https://loanlens-mauve.vercel.app (open in Chrome on a phone, sound on)

## The problem
Many borrowers cannot read the loan paper, or do not follow the language it is explained in. They trust the agent and sign, or press a thumb. RBI's Key Facts Statement (KFS) circular (RBI/2024-25/18, April 2024) requires lenders to explain the KFS in a language the borrower understands and take an acknowledgement that she understood. On paper that acknowledgement is a signature. Nothing checks that the understanding is real.

## The solution
LoanLens is a voice-first, borrower-side understanding check. **Everything is said out loud** in the borrower's language (Hindi, English, Marathi; two voices; replay and slow buttons), so she never has to read or type. It gives **proof of understanding, alongside the signature**. It is not a signature and not a loan approval.

## How it works
- **Load the paper:** scan a lender's QR, share the KFS PDF, or use the built-in sample. Terms are read from the paper by plain code.
- **Agent side:** the agent records a spoken consent line, then reads the key terms aloud. Each term is compared with the paper. "No processing fee" against a paper that says ₹1,500 is flagged as different.
- **Borrower side (teach-back):** she explains the loan back in her own words: money in hand, instalment, fee, and what happens if she misses one. Open questions come in random order. She passes only when her answers match the paper. After three failed tries it says: do not sign yet, bring someone you trust.
- **Result:** matched, different, not mentioned, or couldn't check, with the question to ask the lender and where to complain (lender grievance officer; RBI CMS). A shareable PDF receipt holds the terms, both sides' words and SHA-256 fingerprints of the paper and each recording.
- **Call check (sample only):** a synthetic sales call is transcribed and its promises are compared with the paper.

## Gnani AI models used
| Model | Role |
|---|---|
| **Gnani Prisma v3.0** (speech-to-text) | Hears the agent and the borrower (Hindi + English, numbers as digits, loan keyterms). v2.5 is the fallback. |
| **Gnani Timbre v2.5** (text-to-speech) | Speaks every instruction, question and result. Fixed sample narration is pre-generated with real Timbre calls for instant playback; everything else is spoken live. |

No other AI or ML model is used: no OCR, no third-party LLM, no browser speech recognition, no voice biometrics.

## Design choices
- **No LLM decides anything.** Extraction, comparison and verdicts are deterministic, unit-tested TypeScript rules (500+ tests). Unknown stays unknown and is never treated as zero; only like-for-like fields are compared.
- **Never claims a verdict.** No "safe", "approved", "verified" or "fraud". Colour, icon and sound back every spoken result.
- **Privacy:** nothing records in the background, the recording state is always visible, there is no login or database, and one button erases the session. Demo data is synthetic only. The API key stays on the server.

## Who it is for
Borrowers who cannot read or do not follow the language; the field agent; the lender (a record that terms were explained); and a helper such as an SHG member or family member.

## Honest limits
Hindi is the most tested flow. Marathi wording is still under review, and other Gnani languages are marked Beta and not yet enabled. Recognition accuracy has not been measured on a large set, so no accuracy figure is claimed. A spoken answer is not a legal signature.

Built solo by Ananya Pandey for the Great Indian AI Internship Challenge. #GnaniAI #GreatIndianAIInternshipChallenge
