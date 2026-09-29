"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  BellRinging,
  CheckCircle,
  DotsThreeVertical,
  HandCoins,
  PencilSimple,
  Phone,
  Plus,
  Receipt,
  Trash,
} from "@phosphor-icons/react";
import { describeDay, formatINR, formatPhone, type TransactionType } from "@hisabkitaab/shared";
import { archiveContact, deleteContact, describeError, isOfflineError, recordPayment } from "@hisabkitaab/shared/data";
import { useContactLedger, useHisab } from "@hisabkitaab/shared/react";
import { useServices } from "@/components/app/AppServices";
import { useDialogs } from "@/components/app/DialogsProvider";
import { EntryRow, PaymentRow } from "@/components/app/Rows";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { AnimatedAmount, Card, EmptyState, PersonAvatar, RowSkeleton, SectionHeader, Skeleton } from "@/components/ui/Display";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";
import { analytics } from "@/lib/analytics";

export default function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, contactsById, balances, status } = useHisab();
  const { db, uid } = useServices();
  const dialogs = useDialogs();
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();
  const ledger = useContactLedger(id);
  const contact = contactsById.get(id);
  const balance = balances.get(id);
  const [settling, setSettling] = useState<TransactionType | null>(null);

  if (status === "loading") {
    return (
      <div className="flex flex-col gap-5" aria-busy>
        <Skeleton className="h-16 w-64" />
        <Skeleton className="h-36 w-full rounded-[var(--radius-card)]" />
        <RowSkeleton rows={4} />
      </div>
    );
  }
  if (!contact) {
    return (
      <EmptyState
        icon={<Receipt size={30} weight="duotone" />}
        title={t("errors.notFound")}
        action={
          <Link href="/people" className="font-bold text-primary">
            {t("common.back")}
          </Link>
        }
      />
    );
  }

  const toReceive = balance?.toReceive ?? 0;
  const toPay = balance?.toPay ?? 0;
  const net = balance?.net ?? 0;
  const first = contact.name.split(" ")[0] ?? contact.name;

  async function settleAll(type: TransactionType) {
    if (!contact) return;
    const amount = type === "RECEIVABLE" ? toReceive : toPay;
    const ok = await confirm({
      title: t("payment.markPaidTitle"),
      body:
        type === "RECEIVABLE"
          ? t("payment.markPaidBodyReceive", { name: contact.name, amount: formatINR(amount) })
          : t("payment.markPaidBodyPay", { name: contact.name, amount: formatINR(amount) }),
      confirmLabel: t("person.markPaid"),
      cancelLabel: t("common.cancel"),
    });
    if (!ok) return;
    setSettling(type);
    try {
      await recordPayment(db, uid, { contactId: contact.id, type, amount: amount / 100 });
      analytics.track("transaction_paid", { type, full: true });
      toast.success(t("payment.savedSettled", { amount: formatINR(amount) }));
    } catch (error) {
      toast.error(isOfflineError(error) ? t("errors.offlinePayment") : describeError(t, error));
    } finally {
      setSettling(null);
    }
  }

  async function archive() {
    if (!contact) return;
    if (balance && balance.openCount > 0) {
      toast.error(t("people.archiveBlocked", { name: contact.name }));
      return;
    }
    const ok = await confirm({
      title: t("people.archive"),
      body: t("people.archiveBody", { name: contact.name }),
      confirmLabel: t("people.archive"),
      cancelLabel: t("common.cancel"),
    });
    if (!ok) return;
    try {
      await archiveContact(db, uid, contact.id);
      toast.success(t("people.archived", { name: contact.name }));
      router.replace("/people");
    } catch (error) {
      toast.error(describeError(t, error));
    }
  }

  async function remove() {
    if (!contact) return;
    if (ledger.entries.length > 0) {
      toast.error(t("people.deleteBlocked", { name: contact.name }));
      return;
    }
    const ok = await confirm({
      title: t("people.delete"),
      body: t("people.deleteBody", { name: contact.name }),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteContact(db, uid, contact.id);
      toast.success(t("people.deleted", { name: contact.name }));
      router.replace("/people");
    } catch (error) {
      toast.error(describeError(t, error));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <Link href="/people" className="-ml-2 inline-flex h-10 items-center gap-1.5 rounded-full px-2 text-sm font-semibold text-body hover:bg-sunken">
          <ArrowLeft size={18} weight="bold" aria-hidden /> {t("people.title")}
        </Link>
        <PersonMenu
          onEdit={() => dialogs.open({ type: "person", contactId: contact.id })}
          onArchive={() => void archive()}
          onDelete={() => void remove()}
          canDelete={ledger.status === "ready" && ledger.entries.length === 0}
        />
      </div>

      <header className="flex items-center gap-4">
        <PersonAvatar id={contact.id} name={contact.name} size="lg" />
        <div className="min-w-0">
          <h1 className="truncate text-[26px] leading-tight font-extrabold tracking-tight text-ink lg:text-[30px]">{contact.name}</h1>
          <a href={`tel:${contact.phone}`} className="tabular mt-0.5 inline-flex items-center gap-1.5 text-[15px] font-semibold text-body hover:text-primary">
            <Phone size={16} weight="bold" aria-hidden />
            {formatPhone(contact.phone)}
          </a>
          {contact.notes ? <p className="mt-0.5 text-sm text-muted">{contact.notes}</p> : null}
        </div>
      </header>

      {/* Balance */}
      <div className={cn("grid gap-3", toReceive > 0 && toPay > 0 ? "sm:grid-cols-2" : "")}>
        {toReceive > 0 || toPay === 0 ? (
          <BalancePanel
            label={t("person.totalToReceive")}
            paise={toReceive}
            tone="receive"
            footer={
              toReceive > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<HandCoins size={18} weight="bold" />}
                    onClick={() => dialogs.open({ type: "payment", contactId: contact.id, entryType: "RECEIVABLE" })}
                  >
                    {t("person.recordPayment")}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<CheckCircle size={18} weight="bold" />}
                    loading={settling === "RECEIVABLE"}
                    onClick={() => void settleAll("RECEIVABLE")}
                  >
                    {t("person.markPaid")}
                  </Button>
                </div>
              ) : null
            }
          />
        ) : null}
        {toPay > 0 ? (
          <BalancePanel
            label={t("person.totalToPay")}
            paise={toPay}
            tone="pay"
            footer={
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<HandCoins size={18} weight="bold" />}
                  onClick={() => dialogs.open({ type: "payment", contactId: contact.id, entryType: "PAYABLE" })}
                >
                  {t("person.recordPayment")}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<CheckCircle size={18} weight="bold" />}
                  loading={settling === "PAYABLE"}
                  onClick={() => void settleAll("PAYABLE")}
                >
                  {t("person.markPaid")}
                </Button>
              </div>
            }
          />
        ) : null}
      </div>
      {toReceive > 0 && toPay > 0 ? (
        <p className="tabular -mt-1 text-center text-[15px] font-semibold text-body">
          {t("person.balance")}:{" "}
          <span className={net >= 0 ? "text-receive" : "text-pay"}>
            {net >= 0 ? t("money.netReceive", { amount: formatINR(net) }) : t("money.netPay", { amount: formatINR(-net) })}
          </span>
        </p>
      ) : null}

      {/* Primary actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button size="lg" variant="primary" icon={<Plus size={20} weight="bold" />} onClick={() => dialogs.open({ type: "addHisab", contactId: contact.id })}>
          <span className="sm:hidden">{t("nav.addHisab")}</span>
          <span className="hidden sm:inline">{t("person.addEntry")}</span>
        </Button>
        <Button
          size="lg"
          variant="accent"
          icon={<BellRinging size={20} weight="bold" />}
          disabled={toReceive === 0}
          onClick={() => {
            analytics.track("reminder_clicked", { from: "person" });
            dialogs.open({ type: "reminder", contactId: contact.id, kind: "REMINDER" });
          }}
        >
          {t("person.sendReminder")}
        </Button>
      </div>
      {contact.lastReminderAt ? (
        <p className="-mt-2 text-center text-[13px] text-muted">
          {t("person.lastReminder", { when: describeDay(t, contact.lastReminderAt) })}
        </p>
      ) : null}

      {/* Timeline */}
      <Card className="px-3 pt-3 pb-1 sm:px-4">
        <div className="px-1">
          <SectionHeader title={t("person.history")} />
        </div>
        {ledger.status === "loading" ? (
          <RowSkeleton rows={4} />
        ) : ledger.timeline.length === 0 ? (
          <EmptyState
            compact
            icon={<Receipt size={28} weight="duotone" />}
            title={t("empty.personNoEntriesTitle", { name: first })}
            body={t("empty.personNoEntriesBody")}
          />
        ) : (
          <ul className="divide-y divide-line">
            {ledger.timeline.map((item) =>
              item.kind === "entry" ? (
                <EntryRow key={`e-${item.id}`} entry={item.entry} />
              ) : (
                <PaymentRow key={`p-${item.id}`} payment={item.payment} />
              ),
            )}
          </ul>
        )}
        {ledger.hasMore ? (
          <div className="flex justify-center py-3">
            <Button variant="ghost" size="sm" onClick={ledger.loadMore}>
              {t("common.loadMore")}
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function BalancePanel({
  label,
  paise,
  tone,
  footer,
}: {
  label: string;
  paise: number;
  tone: "receive" | "pay";
  footer?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-[var(--radius-card)] border p-5",
        tone === "receive" ? "border-receive/20 bg-receive-soft" : "border-pay/20 bg-pay-soft",
      )}
    >
      <div>
        <p className={cn("text-sm font-bold", tone === "receive" ? "text-receive" : "text-pay")}>{label}</p>
        <AnimatedAmount
          paise={paise}
          className={cn("mt-1 block text-[36px] leading-none font-extrabold tracking-tight", tone === "receive" ? "text-receive" : "text-pay")}
        />
      </div>
      {footer}
    </div>
  );
}

function PersonMenu({
  onEdit,
  onArchive,
  onDelete,
  canDelete,
}: {
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const { t } = useHisab();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const item = "flex h-11 w-full items-center gap-3 px-4 text-left text-[15px] font-semibold hover:bg-sunken";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={t("person.more")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex size-11 items-center justify-center rounded-full text-body hover:bg-sunken"
      >
        <DotsThreeVertical size={22} weight="bold" />
      </button>
      {open ? (
        <div role="menu" className="absolute top-12 right-0 z-20 w-56 overflow-hidden rounded-2xl border border-line bg-surface py-1.5 shadow-[var(--shadow-raised)]">
          <button role="menuitem" type="button" className={cn(item, "text-ink")} onClick={() => { setOpen(false); onEdit(); }}>
            <PencilSimple size={18} aria-hidden /> {t("people.edit")}
          </button>
          <button role="menuitem" type="button" className={cn(item, "text-ink")} onClick={() => { setOpen(false); onArchive(); }}>
            <Archive size={18} aria-hidden /> {t("people.archive")}
          </button>
          {canDelete ? (
            <button role="menuitem" type="button" className={cn(item, "text-pay")} onClick={() => { setOpen(false); onDelete(); }}>
              <Trash size={18} aria-hidden /> {t("people.delete")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
