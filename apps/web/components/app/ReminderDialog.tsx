"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ChatCircleText,
  CheckCircle,
  Copy,
  PaperPlaneTilt,
  ShareNetwork,
  WarningCircle,
  WhatsappLogo,
} from "@phosphor-icons/react";
import {
  buildMessage,
  describeDay,
  newEntryContext,
  outstanding,
  paymentThanksContext,
  reminderContext,
  type MessageChannel,
  type MessageContext,
  type SendResult,
} from "@hisabkitaab/shared";
import { useHisab } from "@hisabkitaab/shared/react";
import { analytics } from "@/lib/analytics";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { useToast } from "../ui/Toast";
import { cn } from "../ui/cn";
import { useServices } from "./AppServices";
import type { DialogRequest } from "./DialogsProvider";

type Request = Extract<DialogRequest, { type: "reminder" }>;

export function ReminderDialog({ request, onClose }: { request: Request | null; onClose: () => void }) {
  const { t, contactsById } = useHisab();
  const name = request ? (contactsById.get(request.contactId)?.name ?? "") : "";
  const first = name.split(" ")[0] ?? name;
  return (
    <Dialog
      open={request !== null}
      onClose={onClose}
      title={request?.kind === "REMINDER" ? t("reminder.title") : t("reminder.titleNewEntry", { name: first })}
      description={name}
      closeLabel={t("common.close")}
    >
      {request ? <ReminderComposer request={request} onDone={onClose} /> : null}
    </Dialog>
  );
}

const channelMeta: Record<MessageChannel, { icon: ReactNode; label: string }> = {
  SMS: { icon: <ChatCircleText size={20} weight="bold" />, label: "reminder.sendSms" },
  WHATSAPP: { icon: <WhatsappLogo size={20} weight="bold" />, label: "reminder.sendWhatsApp" },
  WHATSAPP_LINK: { icon: <WhatsappLogo size={20} weight="bold" />, label: "reminder.openWhatsApp" },
  SMS_LINK: { icon: <ChatCircleText size={20} weight="bold" />, label: "reminder.openSms" },
  SHARE: { icon: <ShareNetwork size={20} weight="bold" />, label: "reminder.share" },
  COPY: { icon: <Copy size={20} weight="bold" />, label: "reminder.copy" },
};

function pickPrimary(available: MessageChannel[], preferred: "WHATSAPP" | "SMS" | "SHARE"): MessageChannel | null {
  const order: Record<typeof preferred, MessageChannel[]> = {
    WHATSAPP: ["WHATSAPP", "WHATSAPP_LINK", "SMS", "SHARE", "COPY"],
    SMS: ["SMS", "SMS_LINK", "WHATSAPP", "WHATSAPP_LINK", "COPY"],
    SHARE: ["SHARE", "WHATSAPP_LINK", "COPY"],
  };
  return order[preferred].find((c) => available.includes(c)) ?? null;
}

function ReminderComposer({ request, onDone }: { request: Request; onDone: () => void }) {
  const { t, contactsById, openEntries, today, profile } = useHisab();
  const { messages } = useServices();
  const toast = useToast();
  const contact = contactsById.get(request.contactId);

  const [available, setAvailable] = useState<MessageChannel[] | null>(null);
  const [busy, setBusy] = useState<MessageChannel | null>(null);
  const [result, setResult] = useState<SendResult | null>(null);

  useEffect(() => {
    let alive = true;
    void messages.availableChannels().then((channels) => {
      if (!alive) return;
      // Server channels can't build a thank-you note (it needs the payment), so keep those device-only.
      setAvailable(request.kind === "PAYMENT_THANKS" ? channels.filter((c) => c !== "SMS" && c !== "WHATSAPP") : channels);
    });
    return () => {
      alive = false;
    };
  }, [messages, request.kind]);

  const context = useMemo<MessageContext | null>(() => {
    if (!contact) return null;
    if (request.kind === "REMINDER") return reminderContext(contact, openEntries, today, profile, request.transactionId);
    if (request.kind === "PAYMENT_THANKS")
      return paymentThanksContext(contact, request.paymentAmount ?? 0, request.remaining ?? 0, today, profile);
    const entry = openEntries.find((e) => e.id === request.transactionId);
    if (!entry) return reminderContext(contact, openEntries, today, profile);
    const pending = openEntries
      .filter((e) => e.contactId === contact.id && e.type === entry.type)
      .reduce((sum, e) => sum + outstanding(e), 0);
    return newEntryContext(contact, entry, pending, today, profile);
  }, [contact, request, openEntries, today, profile]);

  const body = context ? buildMessage(t, context) : null;

  if (!contact) return <p className="text-muted">{t("errors.notFound")}</p>;
  if (!body || !context) {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <CheckCircle size={40} weight="fill" className="text-receive" aria-hidden />
        <p className="mt-3 font-semibold text-ink">{t("reminder.nothingPending", { name: contact.name })}</p>
      </div>
    );
  }

  const primary = available ? pickPrimary(available, profile?.messagePrefs.defaultChannel ?? "WHATSAPP") : null;
  const secondary = (available ?? []).filter((c) => c !== primary);

  async function send(channel: MessageChannel) {
    if (busy || !context || !body || !contact) return;
    setBusy(channel);
    const res = await messages.send(channel, {
      kind: context.kind,
      contactId: contact.id,
      transactionId: request.transactionId ?? null,
      to: contact.phone,
      body,
    });
    setBusy(null);
    if (res.cancelled) return;
    setResult(res);
    if (res.status === "FAILED") {
      analytics.track("reminder_failed", { channel });
      toast.error(t("reminder.failed", { reason: res.error ?? "" }), undefined, {
        label: t("common.retry"),
        onClick: () => void send(channel),
      });
      return;
    }
    analytics.track("reminder_sent", { channel });
    if (res.status === "SENT") {
      toast.success(t("reminder.sent", { name: contact.name }));
      onDone();
    } else if (res.status === "SIMULATED") {
      toast.info(t("reminder.simulated"));
      onDone();
    } else if (channel === "COPY") {
      toast.success(t("reminder.copied"));
    } else {
      toast.info(t("reminder.shared"));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-sm font-semibold text-muted">{t("reminder.preview")}</p>
        <div className="relative rounded-2xl rounded-tl-md border border-line bg-receive-soft/60 px-4 py-3.5 dark:bg-sunken">
          <p className="text-[15px] leading-relaxed whitespace-pre-line text-ink">{body}</p>
        </div>
        {contact.lastReminderAt ? (
          <p className="mt-2 text-[13px] text-muted">
            {t("person.lastReminder", { when: describeDay(t, contact.lastReminderAt) })}
            {contact.lastReminderStatus ? ` (${t(`reminder.statusLabel.${contact.lastReminderStatus}`)})` : ""}
          </p>
        ) : null}
      </div>

      {result ? <ResultBanner result={result} /> : null}

      {available === null ? (
        <div className="flex flex-col gap-2.5" aria-busy>
          <div className="skeleton h-14" />
          <div className="skeleton h-12" />
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {primary ? (
            <Button
              size="lg"
              variant="accent"
              block
              icon={channelMeta[primary].icon}
              loading={busy === primary}
              loadingText={t("reminder.sending")}
              disabled={busy !== null}
              onClick={() => void send(primary)}
            >
              {t(channelMeta[primary].label as Parameters<typeof t>[0])}
            </Button>
          ) : null}
          <div className={cn("grid gap-2.5", secondary.length > 2 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2")}>
            {secondary.map((channel) => (
              <Button
                key={channel}
                variant="secondary"
                icon={channelMeta[channel].icon}
                loading={busy === channel}
                loadingText={t("reminder.sending")}
                disabled={busy !== null}
                onClick={() => void send(channel)}
                className="px-3"
              >
                {t(channelMeta[channel].label as Parameters<typeof t>[0])}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ResultBanner({ result }: { result: SendResult }) {
  const { t } = useHisab();
  const failed = result.status === "FAILED";
  return (
    <div
      role={failed ? "alert" : "status"}
      className={cn(
        "flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold",
        failed ? "bg-pay-soft text-pay" : "bg-receive-soft text-receive",
      )}
    >
      {failed ? <WarningCircle size={18} weight="fill" aria-hidden /> : <PaperPlaneTilt size={18} weight="fill" aria-hidden />}
      {failed
        ? t("reminder.failed", { reason: result.error ?? "" })
        : result.channel === "COPY"
          ? t("reminder.copied")
          : t(`reminder.statusLabel.${result.status}`)}
    </div>
  );
}
