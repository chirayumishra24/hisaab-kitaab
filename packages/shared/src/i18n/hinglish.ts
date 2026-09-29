import type { DeepPartial } from "./types";
import type { Dictionary } from "./en";

/** Hinglish (partial). Untranslated keys fall back to English. */
export const hinglish: DeepPartial<Dictionary> = {
  money: {
    toReceive: "Lene hain",
    toPay: "Dene hain",
    theyOweMe: "Unhe dena hai",
    iOweThem: "Mujhe dena hai",
    moneyToReceive: "Mujhe paise lene hain",
    moneyToPay: "Mujhe paise dene hain",
  },
  nav: { addHisab: "Hisab jodo" },
  empty: {
    noHisabTitle: "Abhi koi Hisab nahi.",
    noHisabBody: "Pehla person add karo aur apne paison ka hisab rakho.",
    noPendingBody: "Sab clear hai!",
  },
  person: { sendReminder: "Yaad dilao", markPaid: "Paid mark karo" },
  messages: {
    reminder: "Hi {name},\nBas yaad dila rahe hain ki humare pichhle len-den ke {amount} baaki hain.{note}{due}",
    reminderDue: "\nTareekh: {date}",
    signature: "\n\nHisabKitaab\nNo confusion. Just Hisab.",
  },
};
