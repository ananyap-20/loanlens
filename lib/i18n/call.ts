// Words for the call-check door, per verified language (Hindi is the fallback). Spoken lines have no digits.
import type { LangCode } from "./types";

export type CallStrings = {
  say: {
    instruction: string;
    working: string;
    noDifferences: string;
    differencesIntro: string;
    chunkFail: string;
    decodeFail: string;
  };
  ui: {
    title: string;
    door: string;
    syntheticOnly: string;
    upload: string;
    sampleCall: string;
    sameEngine: string;
    part: string;
    transcriptTitle: string;
    callCol: string;
    start: string;
    back: string;
  };
};

const hi: CallStrings = {
  say: {
    instruction:
      "कॉल जाँच। सिर्फ़ बनाई हुई, नकली कॉल की फ़ाइल डालिए, असली कॉल नहीं। या नमूना कॉल वाला बटन दबाइए। कॉल की बातें उसी जाँच से कागज़ से मिलाई जाएँगी।",
    working: "कॉल सुनी जा रही है, थोड़ा रुकिए।",
    noDifferences: "कॉल में कोई बात कागज़ से अलग नहीं मिली।",
    differencesIntro: "कॉल में ये बातें कागज़ से अलग मिलीं।",
    chunkFail: "कॉल का एक हिस्सा नहीं सुन पाई। फिर से कोशिश कीजिए।",
    decodeFail: "यह ऑडियो फ़ाइल खुल नहीं पाई। दूसरी फ़ाइल आज़माइए।",
  },
  ui: {
    title: "📞 कॉल जाँच",
    door: "📞 कॉल जाँच",
    syntheticOnly: "⚠️ सिर्फ़ बनाई हुई (synthetic) कॉल — असली कॉल नहीं",
    upload: "📁 कॉल फ़ाइल",
    sampleCall: "🎧 नमूना कॉल",
    sameEngine: "उसी जाँच इंजन से, जो आमने-सामने की जाँच में है · same engine as the in-person check",
    part: "हिस्सा",
    transcriptTitle: "📝 कॉल में क्या बोला गया",
    callCol: "📞 कॉल",
    start: "▶️ शुरू करें",
    back: "◀️ वापस",
  },
};

const en: CallStrings = {
  say: {
    instruction:
      "Call check. Upload only a made-up, synthetic call, never a real call. Or press the sample call button. What was said on the call is compared with the paper by the same engine.",
    working: "Listening to the call, please wait.",
    noDifferences: "Nothing on the call was different from the paper.",
    differencesIntro: "These points on the call were different from the paper.",
    chunkFail: "One part of the call could not be heard. Please try again.",
    decodeFail: "This audio file could not be opened. Try another file.",
  },
  ui: {
    title: "📞 Call check",
    door: "📞 Call check",
    syntheticOnly: "⚠️ Synthetic calls only — never a real call",
    upload: "📁 Call file",
    sampleCall: "🎧 Sample call",
    sameEngine: "Same engine as the in-person check",
    part: "Part",
    transcriptTitle: "📝 What was said on the call",
    callCol: "📞 Call",
    start: "▶️ Start",
    back: "◀️ Back",
  },
};

const mr: CallStrings = {
  say: {
    instruction:
      "कॉल तपासणी. फक्त बनावट, तयार केलेल्या कॉलची फाइल द्या, खरा कॉल नाही. किंवा नमुना कॉल बटण दाबा. कॉलमधील गोष्टी त्याच तपासणीने कागदाशी जुळवल्या जातील.",
    working: "कॉल ऐकत आहे, थोडे थांबा.",
    noDifferences: "कॉलमधील कोणतीही गोष्ट कागदापेक्षा वेगळी आढळली नाही.",
    differencesIntro: "कॉलमधील या गोष्टी कागदापेक्षा वेगळ्या आढळल्या.",
    chunkFail: "कॉलचा एक भाग ऐकता आला नाही. पुन्हा प्रयत्न करा.",
    decodeFail: "ही ऑडिओ फाइल उघडली नाही. दुसरी फाइल वापरून पहा.",
  },
  ui: {
    title: "📞 कॉल तपासणी",
    door: "📞 कॉल तपासणी",
    syntheticOnly: "⚠️ फक्त बनावट (synthetic) कॉल — खरा कॉल नाही",
    upload: "📁 कॉल फाइल",
    sampleCall: "🎧 नमुना कॉल",
    sameEngine: "समोरासमोरच्या तपासणीतलेच इंजिन · same engine as the in-person check",
    part: "भाग",
    transcriptTitle: "📝 कॉलमध्ये काय बोलले गेले",
    callCol: "📞 कॉल",
    start: "▶️ सुरू करा",
    back: "◀️ मागे",
  },
};

const CALL: Partial<Record<LangCode, CallStrings>> = { hi, en, mr };

export function callStrings(code: LangCode): CallStrings {
  return CALL[code] ?? hi;
}
