"use client";

import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, BellRinging, CaretRight, HandCoins } from "@phosphor-icons/react";
import {
  describeDay,
  describeDue,
  effectiveStatus,
  formatINR,
  formatPhone,
  outstanding,
  paidRatio,
  type Contact,
  type ContactBalance,
  type Payment,
  type Transaction,
} from "@hisabkitaab/shared";
import { useHisab, type TimelineItem } from "@hisabkitaab/shared/react";
import { analytics } from "@/lib/analytics";
import { PersonAvatar, StatusBadge } from "../ui/Display";
import { cn } from "../ui/cn";
import { useDialogs } from "./DialogsProvider";

const dueToneClass = {
  none: "text-muted",
  neutral: "text-muted",
  soon: "text-info",
  overdue: "text-overdue font-semibold",
};

/** One person in a list: who, when due, and the amount in their direction. */
export function PersonRow({
  contact,
  balance,
  showRemind,
  side,
}: {
  contact: Contact;
  balance: ContactBalance;
  showRemind?: boolean;
  /** Force which side to show (dashboard sections). Defaults to the net position. */
  side?: "receive" | "pay";
}) {
  const { t, today } = useHisab();
  const dialogs = useDialogs();
  const direction = side ?? (balance.net > 0 ? "receive" : balance.net < 0 ? "pay" : balance.toReceive > 0 ? "receive" : "none");
  const amount = direction === "receive" ? (side ? balance.toReceive : balance.net) : direction === "pay" ? (side ? balance.toPay : -balance.net) : 0;
  const due = describeDue(t, direction === "pay" ? balance.nextDueDate : balance.nextReceiveDueDate ?? balance.nextDueDate, today);
  const settled = balance.openCount === 0;

  return (
    <li className="group relative flex items-center gap-3 py-3">
      <PersonAvatar id={contact.id} name={contact.name} />
      <div className="min-w-0 flex-1">
        <Link
          href={`/people/${contact.id}`}
          className="block truncate text-[15px] font-bold text-ink after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
        >
          {contact.name}
        </Link>
        <p className={cn("truncate text-[13px]", settled ? "text-muted" : dueToneClass[due.tone])}>
          {settled ? t("money.allClear") : due.tone === "none" ? formatPhone(contact.phone) : due.text}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end">
        {settled ? (
          <span className="text-sm font-semibold text-muted">{formatINR(0)}</span>
        ) : (
          <>
            <span className={cn("tabular text-[16px] font-extrabold", direction === "pay" ? "text-pay" : "text-receive")}>
              {formatINR(amount)}
            </span>
            <span className="text-[12px] font-medium text-muted">
              {direction === "pay" ? t("money.toPay") : t("money.toReceive")}
            </span>
          </>
        )}
      </div>
      {showRemind && balance.toReceive > 0 ? (
        <button
          type="button"
          onClick={() => {
            analytics.track("reminder_clicked", { from: "dashboard" });
            dialogs.open({ type: "reminder", contactId: contact.id, kind: "REMINDER" });
          }}
          className="relative z-10 ml-1 inline-flex h-10 items-center gap-1.5 rounded-full bg-sunken px-3.5 text-sm font-bold text-primary transition-colors hover:bg-line active:scale-95"
        >
          <BellRinging size={16} weight="bold" aria-hidden />
          <span className="hidden sm:inline">{t("person.remind")}</span>
          <span className="sr-only sm:hidden">{t("person.sendReminder")}</span>
        </button>
      ) : (
        <CaretRight size={16} className="shrink-0 text-line-strong" aria-hidden />
      )}
    </li>
  );
}

/** A single Hisab entry (transaction) row. Opens the entry sheet. */
export function EntryRow({ entry, showPerson }: { entry: Transaction; showPerson?: boolean }) {
  const { t, today, contactsById } = useHisab();
  const dialogs = useDialogs();
  const status = effectiveStatus(entry, today);
  const receive = entry.type === "RECEIVABLE";
  const pending = outstanding(entry);
  const person = contactsById.get(entry.contactId);
  const due = describeDue(t, entry.dueDate, today);
  const title = showPerson ? (person?.name ?? "…") : (entry.note ?? (receive ? t("money.theyOweMe") : t("money.iOweThem")));
  const subtitle = showPerson ? (entry.note ?? describeDay(t, entry.createdAt)) : describeDay(t, entry.createdAt);

  return (
    <li>
      <button
        type="button"
        onClick={() => dialogs.open({ type: "entry", transactionId: entry.id })}
        className="flex w-full items-center gap-3 rounded-xl py-3 text-left transition-colors hover:bg-sunken/60 sm:px-2"
      >
        <span
          aria-hidden
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full",
            receive ? "bg-receive-soft text-receive" : "bg-pay-soft text-pay",
          )}
        >
          {receive ? <ArrowDownLeft size={20} weight="bold" /> : <ArrowUpRight size={20} weight="bold" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold text-ink">{title}</span>
          <span className="flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
            <span className="truncate">{subtitle}</span>
            {status !== "PAID" && entry.dueDate ? <span className={dueToneClass[due.tone]}>{due.text}</span> : null}
          </span>
          {entry.paidAmount > 0 && status !== "PAID" ? (
            <span className="mt-1.5 flex items-center gap-2">
              <span className="h-1.5 w-20 overflow-hidden rounded-full bg-line" aria-hidden>
                <span className="block h-full rounded-full bg-receive" style={{ width: `${paidRatio(entry) * 100}%` }} />
              </span>
              <span className="tabular text-[12px] text-muted">
                {t("money.paidOf", { paid: formatINR(entry.paidAmount), total: formatINR(entry.amount) })}
              </span>
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={cn(
              "tabular text-[16px] font-extrabold",
              status === "PAID" ? "text-muted line-through decoration-1" : receive ? "text-receive" : "text-pay",
            )}
          >
            {receive ? "+" : "-"}
            {formatINR(status === "PAID" ? entry.amount : pending)}
          </span>
          {status !== "ACTIVE" ? <StatusBadge status={status} label={t(`status.${status}`)} /> : null}
        </span>
      </button>
    </li>
  );
}

/** A payment row in a timeline. */
export function PaymentRow({ payment, showPerson }: { payment: Payment; showPerson?: boolean }) {
  const { t, contactsById } = useHisab();
  const received = payment.type === "RECEIVABLE";
  const person = contactsById.get(payment.contactId);
  const label = received ? t("person.paymentReceived") : t("person.paymentMade");
  return (
    <li className="flex items-center gap-3 py-3 sm:px-2">
      <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sunken text-body">
        <HandCoins size={20} weight="bold" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold text-ink">{showPerson ? (person?.name ?? "…") : label}</span>
        <span className="block truncate text-[13px] text-muted">
          {showPerson ? `${label} · ` : payment.note ? `${payment.note} · ` : ""}
          {describeDay(t, payment.createdAt)}
        </span>
      </span>
      <span className="tabular shrink-0 text-[16px] font-extrabold text-body">
        {received ? "-" : "+"}
        {formatINR(payment.amount)}
      </span>
    </li>
  );
}

/** Compact line for the dashboard's recent activity. */
export function ActivityLine({ item }: { item: TimelineItem }) {
  const { t, contactsById } = useHisab();
  const dialogs = useDialogs();
  const person = contactsById.get(item.contactId);
  let text: string;
  let tone: string;
  if (item.kind === "entry") {
    const receive = item.entry.type === "RECEIVABLE";
    text = receive
      ? t("dashboard.activityAdded", { amount: formatINR(item.entry.amount) })
      : t("dashboard.activityYouOwe", { amount: formatINR(item.entry.amount) });
    tone = receive ? "bg-receive" : "bg-pay";
  } else {
    const received = item.payment.type === "RECEIVABLE";
    text = received
      ? t("dashboard.activityReceived", { amount: formatINR(item.payment.amount) })
      : t("dashboard.activityPaid", { amount: formatINR(item.payment.amount) });
    tone = "bg-info";
  }
  const content = (
    <>
      <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", tone)} />
      <span className="min-w-0 flex-1">
        <span className="tabular block text-[15px] font-bold text-ink">{text}</span>
        <span className="block truncate text-[13px] text-muted">{person?.name ?? "…"}</span>
      </span>
      <span className="shrink-0 text-[13px] text-muted">{describeDay(t, item.at)}</span>
    </>
  );
  return (
    <li>
      {item.kind === "entry" ? (
        <button
          type="button"
          onClick={() => dialogs.open({ type: "entry", transactionId: item.entry.id })}
          className="flex w-full items-start gap-3 rounded-lg py-2.5 text-left hover:bg-sunken/60"
        >
          {content}
        </button>
      ) : (
        <Link href={`/people/${item.contactId}`} className="flex items-start gap-3 rounded-lg py-2.5 hover:bg-sunken/60">
          {content}
        </Link>
      )}
    </li>
  );
}
