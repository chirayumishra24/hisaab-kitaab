import { dayLabel, dueState, formatDate } from "./dates";
import type { Translate } from "./i18n";
import type { ISODate, Millis } from "./types";

export type DueTone = "none" | "neutral" | "soon" | "overdue";

/** Human text + tone for a due date: "Due in 3 days" / "Overdue by 4 days". */
export function describeDue(t: Translate, dueDate: ISODate | null | undefined, today: ISODate) {
  const state = dueState(dueDate, today);
  switch (state.kind) {
    case "none":
      return { text: t("due.none"), tone: "none" as DueTone };
    case "overdue":
      return {
        text: state.days === 1 ? t("due.overdueOne") : t("due.overdue", { days: state.days }),
        tone: "overdue" as DueTone,
      };
    case "today":
      return { text: t("due.today"), tone: "soon" as DueTone };
    case "tomorrow":
      return { text: t("due.tomorrow"), tone: "soon" as DueTone };
    case "soon":
      return { text: t("due.soon", { days: state.days }), tone: "soon" as DueTone };
    case "later":
      return { text: t("due.later", { date: formatDate(state.date, { short: true, today }) }), tone: "neutral" as DueTone };
  }
}

/** "Today" / "Yesterday" / "12 Sep" for when something was recorded. */
export function describeDay(t: Translate, at: Millis, now: Date | Millis = new Date()): string {
  const label = dayLabel(at, now);
  if (label.kind === "today") return t("common.today");
  if (label.kind === "yesterday") return t("common.yesterday");
  return label.text;
}

/** Pluralised people count. */
export function describePeopleCount(t: Translate, count: number): string {
  return count === 1 ? t("dashboard.peopleCountOne") : t("dashboard.peopleCount", { count });
}
