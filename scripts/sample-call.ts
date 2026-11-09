// The SYNTHETIC sample call (fictional lender, fictional people, no real names or numbers).
// The agent wrongly says there is no processing fee (the paper says ₹1,500), that the full ₹30,000 comes
// in hand (paper: ₹28,500) and that there is no late fee (paper: ₹200). Numbers are words for Timbre.
// Voices: agent = Deepak (Timbre v2.5, Hindi, male), borrower = Nalini (Timbre v2.5, Hindi, female).
export const SAMPLE_CALL_VOICES = { agent: "Deepak", borrower: "Nalini" } as const;

export const SAMPLE_CALL_TURNS: { speaker: "agent" | "borrower"; text: string }[] = [
  { speaker: "agent", text: "नमस्ते, मैं सहयोग फ़ाइनेंस से बोल रहा हूँ। आपका तीस हज़ार रुपये का लोन तैयार है।" },
  { speaker: "borrower", text: "किस्त कितनी होगी?" },
  { speaker: "agent", text: "किस्त दो हज़ार छह सौ छियासठ रुपये हर महीने, बारह महीने तक।" },
  { speaker: "borrower", text: "कोई प्रोसेसिंग फ़ीस है?" },
  { speaker: "agent", text: "नहीं जी, कोई प्रोसेसिंग फ़ीस नहीं लगेगी। पूरे तीस हज़ार रुपये आपके हाथ में आएँगे।" },
  { speaker: "borrower", text: "और देर होने पर?" },
  { speaker: "agent", text: "देर होने पर कोई जुर्माना नहीं है। बस यहाँ अंगूठा लगा दीजिए।" },
  { speaker: "borrower", text: "ठीक है, पहले मैं कागज़ देख लेती हूँ।" },
];
