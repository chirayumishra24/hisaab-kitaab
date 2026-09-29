"use client";

import { useState } from "react";
import Link from "next/link";
import { BellRinging, CheckCircle, HandCoins, PencilSimple, Trash } from "@phosphor-icons/react";
import {
  describeDue,
  effectiveStatus,
  formatDate,
  formatINR,
  outstanding,
  paidRatio,
  toISODate,
  type TranslationKey,
} from "@hisabkitaab/shared";
import { deleteTransaction, describeError, isOfflineError, recordPayment, updateTransaction } from "@hisabkitaab/shared/data";
import { useEntry, useHisab } from "@hisabkitaab/shared/react";
import { analytics } from "@/lib/analytics";
import { Button } from "../ui/Button";
import { useConfirm } from "../ui/ConfirmDialog";
import { Dialog } from "../ui/Dialog";
import { Skeleton, StatusBadge } from "../ui/Display";
import { Field, Input } from "../ui/Field";
import { Switch } from "../ui/Switch";
import { useToast } from "../ui/Toast";
import { cn } from "../ui/cn";
import { useServices } from "./AppServices";
import { useDialogs, type DialogRequest } from "./DialogsProvider";

type Request = Extract<DialogRequest, { type: "entry" }>;

export function EntryDialog({ request, onClose }: { request: Request | null; onClose: () => void }) {
  const { t } = useHisab();
  return (
    <Dialog open={request !== null} onClose={onClose} title={t("entry.title")} closeLabel={t("common.close")}>
      {request ? <EntryDetails transactionId={request.transactionId} onClose={onClose} /> : null}
    </Dialog>
  );
}

function EntryDetails({ transactionId, onClose }: { transactionId: string; onClose: () => void }) {
  const { t, today, contactsById } = useHisab();
  const { db, uid } = useServices();
  const { entry, status: loadStatus } = useEntry(transactionId);
  const dialogs = useDialogs();
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loadStatus === "loading") {
    return (
      <div className="flex flex-col gap-3" aria-busy>
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (!entry) return <p className="py-6 text-center text-muted">{t("errors.notFound")}</p>;

  const person = contactsById.get(entry.contactId);
  const status = effectiveStatus(entry, today);
  const receive = entry.type === "RECEIVABLE";
  const pending = outstanding(entry);
  const due = describeDue(t, entry.dueDate, today);
  const name = person?.name ?? "";

  async function markPaid() {
    if (!entry) return;
    const ok = await confirm({
      title: t("payment.markPaidTitle"),
      body: receive
        ? t("payment.markPaidBodyReceive", { name, amount: formatINR(pending) })
        : t("payment.markPaidBodyPay", { name, amount: formatINR(pending) }),
      confirmLabel: t("person.markPaid"),
      cancelLabel: t("common.cancel"),
    });
    if (!ok) return;
    setBusy(true);
    try {
      await recordPayment(db, uid, {
        contactId: entry.contactId,
        type: entry.type,
        amount: pending / 100,
        transactionId: entry.id,
      });
      analytics.track("transaction_paid", { type: entry.type, full: true });
      toast.success(t("payment.savedSettled", { amount: formatINR(pending) }));
    } catch (error) {
      toast.error(isOfflineError(error) ? t("errors.offlinePayment") : describeError(t, error));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!entry) return;
    if (entry.paidAmount > 0) {
      toast.error(t("entry.deleteBlocked"));
      return;
    }
    const ok = await confirm({
      title: t("entry.delete"),
      body: t("entry.deleteBody", { amount: formatINR(entry.amount) }),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteTransaction(db, uid, entry.id, entry.paidAmount);
      toast.success(t("entry.deleted"));
      onClose();
    } catch (error) {
      toast.error(describeError(t, error));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-bold", receive ? "text-receive" : "text-pay")}>
            {receive ? t("money.theyOweMe") : t("money.iOweThem")}
          </span>
          <StatusBadge status={status} label={t(`status.${status}`)} />
        </div>
        <p className={cn("tabular mt-1 text-4xl font-extrabold tracking-tight", receive ? "text-receive" : "text-pay")}>
          {formatINR(status === "PAID" ? entry.amount : pending)}
        </p>
        {person ? (
          <Link href={`/people/${person.id}`} onClick={onClose} className="mt-1 inline-block font-semibold text-primary underline-offset-4 hover:underline">
            {person.name}
          </Link>
        ) : null}
        {entry.paidAmount > 0 ? (
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded-full bg-line" aria-hidden>
              <div className="h-full rounded-full bg-receive transition-[width] duration-500" style={{ width: `${paidRatio(entry) * 100}%` }} />
            </div>
            <p className="tabular mt-1.5 text-sm text-muted">
              {t("money.paidOf", { paid: formatINR(entry.paidAmount), total: formatINR(entry.amount) })}
            </p>
          </div>
        ) : null}
      </div>

      {editing ? (
        <EditEntryForm entryId={entry.id} note={entry.note} dueDate={entry.dueDate} onDone={() => setEditing(false)} />
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-[var(--radius-control)] bg-sunken p-4 text-sm">
          <div>
            <dt className="text-muted">{t("entryForm.note")}</dt>
            <dd className="font-semibold text-ink">{entry.note ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-muted">{t("entryForm.dueDate")}</dt>
            <dd className={cn("font-semibold", due.tone === "overdue" ? "text-overdue" : "text-ink")}>
              {entry.dueDate ? formatDate(entry.dueDate) : t("due.none")}
            </dd>
          </div>
          <div>
            <dt className="text-muted">{t("entry.added", { date: "" }).trim()}</dt>
            <dd className="font-semibold text-ink">{formatDate(toISODate(entry.createdAt))}</dd>
          </div>
          <div>
            <dt className="text-muted">{t("reminder.preview")}</dt>
            <dd className="font-semibold text-ink">{t(`reminder.statusLabel.${entry.messageStatus}` as TranslationKey)}</dd>
          </div>
          {entry.category ? (
            <div>
              <dt className="text-muted">{t("entryForm.category")}</dt>
              <dd className="font-semibold text-ink">{entry.category}</dd>
            </div>
          ) : null}
        </dl>
      )}

      {status !== "PAID" && entry.dueDate && receive && !editing ? (
        <Switch
          checked={entry.reminderEnabled}
          onChange={(checked) =>
            void updateTransaction(db, uid, entry.id, { reminderEnabled: checked }).catch((e) => toast.error(describeError(t, e)))
          }
          label={t("entryForm.reminder")}
        />
      ) : null}

      {status !== "PAID" ? (
        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <Button
              variant="primary"
              icon={<CheckCircle size={20} weight="bold" />}
              loading={busy}
              onClick={() => void markPaid()}
            >
              {t("person.markPaid")}
            </Button>
            <Button
              variant="secondary"
              icon={<HandCoins size={20} weight="bold" />}
              onClick={() => dialogs.open({ type: "payment", contactId: entry.contactId, entryType: entry.type, transactionId: entry.id })}
            >
              {t("person.recordPayment")}
            </Button>
          </div>
          {receive ? (
            <Button
              variant="soft"
              icon={<BellRinging size={20} weight="bold" />}
              onClick={() => {
                analytics.track("reminder_clicked", { from: "entry" });
                dialogs.open({ type: "reminder", contactId: entry.contactId, kind: "REMINDER", transactionId: entry.id });
              }}
            >
              {t("person.sendReminder")}
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="flex items-center gap-2 rounded-xl bg-receive-soft px-4 py-3 text-sm font-semibold text-receive">
          <CheckCircle size={20} weight="fill" aria-hidden />
          {entry.paidAt ? t("entry.paidOn", { date: formatDate(toISODate(entry.paidAt)) }) : t("status.PAID")}
        </p>
      )}

      {!editing ? (
        <div className="flex items-center justify-between border-t border-line pt-3">
          <Button variant="ghost" size="sm" icon={<PencilSimple size={18} />} onClick={() => setEditing(true)}>
            {t("entry.edit")}
          </Button>
          {entry.paidAmount === 0 ? (
            <Button variant="ghost" size="sm" className="text-pay" icon={<Trash size={18} />} onClick={() => void remove()}>
              {t("entry.delete")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function EditEntryForm({
  entryId,
  note: initialNote,
  dueDate: initialDue,
  onDone,
}: {
  entryId: string;
  note: string | null;
  dueDate: string | null;
  onDone: () => void;
}) {
  const { t } = useHisab();
  const { db, uid } = useServices();
  const toast = useToast();
  const [note, setNote] = useState(initialNote ?? "");
  const [dueDate, setDueDate] = useState(initialDue ?? "");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateTransaction(db, uid, entryId, { note, dueDate: dueDate || null });
      toast.success(t("people.updated"));
      onDone();
    } catch (error) {
      toast.error(describeError(t, error));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-3 rounded-[var(--radius-control)] bg-sunken p-4">
      <Field label={t("entryForm.note")} optional optionalLabel={t("common.optional")}>
        <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} data-autofocus />
      </Field>
      <Field label={t("entryForm.dueDate")} optional optionalLabel={t("common.optional")}>
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-2.5">
        <Button variant="secondary" onClick={onDone}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" loading={saving} loadingText={t("common.saving")}>
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}
