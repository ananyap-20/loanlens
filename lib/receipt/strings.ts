// Words used on the receipt PDF. HI_RECEIPT is exactly what the receipt has always said; other languages
// come from their language pack. English sub-labels on the PDF stay English in every language.
export type ReceiptStrings = {
  title: string;
  present: string;
  presence: { with_agent: string; alone: string };
  docFingerprint: string;
  outcomePassed: string;
  outcomeStopped: string;
  cols: { item: string; paper: string; agent: string; borrower: string };
  cell: {
    match: string;
    conflict: string;
    notMentioned: string;
    unable: string;
    notOnPaper: string;
    writtenTwice: string;
    notAsked: string;
    saidNotCharged: string;
    noClearAmount: string;
    gatePassed: string;
    gateFailed: string;
    gatePending: string;
    gateNotOnPaper: string;
  };
  freq: { monthly: string; weekly: string; fortnightly: string; once: string };
  months: string;
  weeks: string;
  questionsTitle: string;
  complaintTitle: string;
  grievanceOfficer: string; // "1. लेंडर के शिकायत अधिकारी: " + line
  grievanceAsk: string;
  rbi: string;
  label: string; // local-language version of the required label
  evidenceTitle: string;
  termsTitle: string;
  agentVsPaperTitle: string;
  ownWordsTitle: string;
  recordingsTitle: string;
  fullFingerprintsTitle: string;
  recCols: { who: string; what: string; time: string; transcript: string };
  speaker: { agent: string; borrower: string; helper: string };
  agentChanged: string;
  disclaimer: string; // footer line on every page
};

export const HI_RECEIPT: ReceiptStrings = {
  title: "LoanLens रसीद",
  present: "मौजूद",
  presence: { with_agent: "ग्राहक और एजेंट", alone: "ग्राहक" },
  docFingerprint: "दस्तावेज़ फ़िंगरप्रिंट",
  outcomePassed: "✅ समझ का सबूत, साइन के साथ",
  outcomeStopped: "✋ अभी साइन मत कीजिए — किसी भरोसे वाले को साथ लाइए",
  cols: { item: "बात", paper: "📄 कागज़", agent: "🧑‍💼 एजेंट", borrower: "🧑 ग्राहक" },
  cell: {
    match: "मिलता है",
    conflict: "अलग है",
    notMentioned: "नहीं बोला",
    unable: "जाँच नहीं पाए",
    notOnPaper: "कागज़ पर नहीं लिखा",
    writtenTwice: "कागज़ पर दो अलग बातें",
    notAsked: "नहीं पूछा गया",
    saidNotCharged: "₹0 (कहा: नहीं लगेगी)",
    noClearAmount: "साफ़ रक़म नहीं",
    gatePassed: "अपने शब्दों में सही बताया",
    gateFailed: "3 बार अलग बताया",
    gatePending: "जाँच नहीं हुई",
    gateNotOnPaper: "कागज़ पर नहीं",
  },
  freq: { monthly: " हर महीने", weekly: " हर हफ़्ते", fortnightly: " हर 15 दिन", once: "" },
  months: "महीने",
  weeks: "हफ़्ते",
  questionsTitle: "❓ साइन करने से पहले लेंडर से पूछिए",
  complaintTitle: "📢 शिकायत कहाँ करें",
  grievanceOfficer: "1. लेंडर के शिकायत अधिकारी: ",
  grievanceAsk: "1. लेंडर से शिकायत अधिकारी का नाम लिखकर माँगिए",
  rbi: "2. RBI शिकायत पोर्टल: cms.rbi.org.in",
  label: "समझ का सबूत — यह साइन नहीं है, और लोन की मंज़ूरी भी नहीं",
  evidenceTitle: "सबूत",
  termsTitle: "कागज़ की बातें",
  agentVsPaperTitle: "एजेंट बनाम कागज़",
  ownWordsTitle: "ग्राहक के अपने शब्द",
  recordingsTitle: "सारी रिकॉर्डिंग (पहली और दोबारा वाली)",
  fullFingerprintsTitle: "पूरे फ़िंगरप्रिंट",
  recCols: { who: "कौन", what: "क्या", time: "समय", transcript: "जो बोला" },
  speaker: { agent: "एजेंट", borrower: "ग्राहक", helper: "मददगार" },
  agentChanged: "एजेंट ने पहले अलग बताया था",
  disclaimer:
    "Beta चिह्न वाली भाषाओं की अभी जाँच चल रही है, और उनके शब्दों को किसी मूल वक्ता ने नहीं परखा है। LoanLens हस्ताक्षर के साथ समझ का सबूत देता है। यह हस्ताक्षर नहीं है और लोन की मंज़ूरी भी नहीं।",
};
