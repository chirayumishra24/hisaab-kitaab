"use client";

import { useMemo, useRef, useState } from "react";
import {
  formatINR,
  outstanding,
  paiseToInputValue,
  paymentInputSchema,
  validate,
  type TranslationKey,
} from "@hisabkitaab/shared";
import { describeError, isOfflineError, recordPayment } from "@hisabkitaab/shared/data";
import { useHisab } from "@hisabkitaab/shared/react";
import { analytics } from "@/lib/analytics";
import { AmountInput } from "../ui/AmountInput";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Field, Input } from "../ui/Field";
import { useToast } from "../ui/Toast";
import { useServices } from "./AppServices";
import { useDialogs, type DialogRequest } from "./DialogsProvider";

type Request = Extract<DialogRequest, { type: "payment" }>;

export function PaymentDialog({ request, onClose }: { request: Request | null; onClose: () => void }) {
  const { t, contactsById } = useHisab();
  const name = request ? (contactsById.get(request.contactId)?.name ?? "") : "";
  return (
    <Dialog
      open={request !== null}
      onClose={onClose}
      title={request?.entryType === "PAYABLE" ? t("payment.titlePay") : t("payment.titleReceive")}
      description={request ? (request.entryType === "PAYABLE" ? t("payment.to", { name }) : t("payment.from", { name })) : undefined}
      closeLabel={t("common.close")}
    >
      {request ? <PaymentForm request={request} onDone={onClose} /> : null}
    </Dialog>
  );
}

function PaymentForm({ request, onDone }: { request: Request; onDone: () => void }) {
  const { t, openEntries, contactsById } = useHisab();
  const { db, uid } = useServices();
  const toast = useToast();
  const dialogs = useDialogs();
  const amountRef = useRef<HTMLInputElement>(null);

  const entry = request.transactionId ? openEntries.find((e) => e.id === request.transactionId) : undefined;
  const pending = useMemo(() => {
    if (request.transactionId) return entry ? outstanding(entry) : 0;
    return openEntries
      .filter((e) => e.contactId === request.contactId && e.type === request.entryType)
      .reduce((sum, e) => sum + outstanding(e), 0);
  }, [openEntries, request, entry]);

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const input = {
      contactId: request.contactId,
      type: request.entryType,
      amount,
      note,
      transactionId: request.transactionId ?? null,
    };
    const result = validate(paymentInputSchema, input);
    if (!result.ok) {
      setError(t((result.errors.amount ?? result.errors.note ?? "errors.generic") as TranslationKey));
      amountRef.current?.focus();
      return;
    }
    if (result.data.amount > pending) {
      setError(t("errors.amountExceeds", { amount: formatINR(pending) }));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // Data functions take rupee input and validate it themselves, so pass the raw input, not paise.
      const paid = await recordPayment(db, uid, input);
      analytics.track("transaction_paid", { type: request.entryType, full: paid.remaining === 0 });
      const text =
        paid.remaining > 0
          ? t("payment.saved", { amount: formatINR(result.data.amount), remaining: formatINR(paid.remaining) })
          : t("payment.savedSettled", { amount: formatINR(result.data.amount) });
      const contact = contactsById.get(request.contactId);
      if (request.entryType === "RECEIVABLE" && contact) {
        toast.show({
          tone: "success",
          title: text,
          action: {
            label: t("reminder.titleNewEntry", { name: contact.name.split(" ")[0] ?? contact.name }),
            onClick: () =>
              dialogs.open({
                type: "reminder",
                contactId: request.contactId,
                kind: "PAYMENT_THANKS",
                paymentAmount: result.data.amount,
                remaining: paid.remaining,
              }),
          },
        });
      } else {
        toast.success(text);
      }
      onDone();
    } catch (err) {
      setError(isOfflineError(err) ? t("errors.offlinePayment") : describeError(t, err));
      setSubmitting(false);
    }
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-[var(--radius-control)] bg-sunken px-4 py-3">
        <div>
          <p className="text-[13px] font-semibold text-muted">
            {entry?.note ? t("payment.onEntry", { note: entry.note }) : t("payment.pendingLabel")}
          </p>
          <p className="tabular text-xl font-extrabold text-ink">{formatINR(pending)}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setAmount(paiseToInputValue(pending))} disabled={pending === 0}>
          {t("payment.fullAmount")}
        </Button>
      </div>
      <Field label={t("payment.amount")} error={error}>
        <AmountInput
          ref={amountRef}
          value={amount}
          onValueChange={setAmount}
          tone={request.entryType === "RECEIVABLE" ? "receive" : "pay"}
          data-autofocus
        />
      </Field>
      <Field label={t("payment.note")} optional optionalLabel={t("common.optional")}>
        <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} />
      </Field>
      <Button type="submit" size="lg" block loading={submitting} loadingText={t("common.saving")} disabled={pending === 0}>
        {t("payment.submit")}
      </Button>
    </form>
  );
}
