import type { DeepPartial } from "./types";
import type { Dictionary } from "./en";

/** Hindi (partial). Untranslated keys fall back to English. */
export const hi: DeepPartial<Dictionary> = {
  brand: { tagline: "कोई उलझन नहीं। सिर्फ़ हिसाब।" },
  common: {
    save: "सेव करें",
    cancel: "रद्द करें",
    close: "बंद करें",
    back: "वापस",
    edit: "बदलें",
    delete: "हटाएँ",
    today: "आज",
    yesterday: "कल",
    retry: "फिर से कोशिश करें",
  },
  nav: { home: "होम", people: "लोग", activity: "गतिविधि", settings: "सेटिंग्स", addHisab: "हिसाब जोड़ें" },
  money: {
    toReceive: "लेने हैं",
    toPay: "देने हैं",
    overdue: "बकाया",
    theyOweMe: "उन्हें देना है",
    iOweThem: "मुझे देना है",
    moneyToReceive: "मुझे पैसे लेने हैं",
    moneyToPay: "मुझे पैसे देने हैं",
    allClear: "सब साफ़",
  },
  status: { ACTIVE: "बाकी", PARTIALLY_PAID: "आंशिक", PAID: "चुकता", OVERDUE: "बकाया" },
  dashboard: {
    title: "आपका हिसाब",
    whoOwesYou: "जिनसे पैसे लेने हैं",
    whoYouOwe: "जिन्हें पैसे देने हैं",
    recentActivity: "हाल की गतिविधि",
  },
  empty: {
    noHisabTitle: "अभी कोई हिसाब नहीं।",
    noHisabBody: "पहला व्यक्ति जोड़ें और अपने पैसों का हिसाब रखना शुरू करें।",
    noPendingTitle: "कोई भुगतान बाकी नहीं।",
    noPendingBody: "सब साफ़ है!",
  },
  filters: { ALL: "सभी", RECEIVE: "लेने हैं", PAY: "देने हैं", OVERDUE: "बकाया", PAID: "चुकता", SETTLED: "साफ़" },
  people: { title: "लोग", add: "व्यक्ति जोड़ें", searchPlaceholder: "नाम या नंबर से खोजें" },
  person: { sendReminder: "याद दिलाएँ", markPaid: "चुकता करें", addEntry: "लेन-देन जोड़ें" },
  personForm: { fromContacts: "फ़ोन के कॉन्टैक्ट से चुनें" },
  reminder: {
    sendWhatsApp: "WhatsApp पर भेजें",
    copy: "मैसेज कॉपी करें",
    share: "शेयर करें",
    fromYourNumber: "मैसेज आपके अपने नंबर से जाएगा। WhatsApp या SMS ऐप में मैसेज तैयार मिलेगा, बस Send दबाएँ।",
  },
  messages: {
    reminder: "नमस्ते {name},\nयाद दिला रहे हैं कि हमारे पिछले लेन-देन के {amount} बाकी हैं।{note}{due}",
    reminderNote: "\nकिसलिए: {note}",
    reminderDue: "\nतारीख़: {date}",
    reminderOverdue: "\nयह {date} को देना था।",
    signature: "\n\nHisabKitaab\nकोई उलझन नहीं। सिर्फ़ हिसाब।",
  },
  settings: { title: "सेटिंग्स", language: "भाषा", profile: "प्रोफ़ाइल" },
  auth: { login: "लॉग इन करें", signup: "खाता बनाएँ", logout: "लॉग आउट" },
};
