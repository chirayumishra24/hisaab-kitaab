"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowDownLeft, ArrowUpRight, CaretDown, Check, PaperPlaneTilt, Plus, UserPlus } from "@phosphor-icons/react";
import {
  addDays,
  contactInputSchema,
  formatINR,
  formatPhone,
  transactionInputSchema,
  validate,
  type TransactionType,
  type TranslationKey,
} from "@hisabkitaab/shared";
import { createContact, createTransaction, describeError } from "@hisabkitaab/shared/data";
import { useHisab } from "@hisabkitaab/shared/react";
import { analytics } from "@/lib/analytics";
import { AmountInput } from "../ui/AmountInput";
import { Button, buttonClasses } from "../ui/Button";
import { ChipGroup } from "../ui/Chips";
import { Dialog } from "../ui/Dialog";
import { PersonAvatar } from "../ui/Display";
import { Field, Input } from "../ui/Field";
import { Switch } from "../ui/Switch";
import { useToast } from "../ui/Toast";
import { cn } from "../ui/cn";
import { useServices } from "./AppServices";
import { PickContactButton, type PickedContact } from "./ContactPicker";
import { useDialogs, type DialogRequest } from "./DialogsProvider";

type DueChoice = "none" | "week" | "twoWeeks" | "month" | "pick";
const CATEGORIES = ["groceries", "goods", "loan", "rent", "services", "family", "other"] as const;

interface Saved {
  transactionId: string;
  contactId: string;
  name: string;
  amount: number;
  type: TransactionType;
}

export function AddHisabDialog({
  request,
  onClose,
}: {
  request: Extract<DialogRequest, { type: "addHisab" }> | null;
  onClose: () => void;
}) {
  const { t } = useHisab();
  const [saved, setSaved] = useState<Saved | null>(null);
  return (
    <Dialog
      open={request !== null}
      onClose={onClose}
      title={saved ? t("common.done") : t("entryForm.title")}
      hideTitle={saved !== null}
      closeLabel={t("common.close")}
    >
      {request ? (
        saved ? (
          <SavedView saved={saved} onAddAnother={() => setSaved(null)} onClose={onClose} />
        ) : (
          <AddHisabForm request={request} onSaved={setSaved} />
        )
      ) : null}
    </Dialog>
  );
}

function AddHisabForm({
  request,
  onSaved,
}: {
  request: Extract<DialogRequest, { type: "addHisab" }>;
  onSaved: (saved: Saved) => void;
}) {
  const { t, people, contactsById, today, search } = useHisab();
  const { db, uid } = useServices();
  const toast = useToast();
  const amountRef = useRef<HTMLInputElement>(null);

  const [contactId, setContactId] = useState<string | null>(request.contactId ?? null);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(people.length === 0);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [type, setType] = useState<TransactionType>(request.entryType ?? "RECEIVABLE");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [due, setDue] = useState<DueChoice>("none");
  const [pickedDate, setPickedDate] = useState("");
  const [reminder, setReminder] = useState(true);
  const [showMore, setShowMore] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const selected = contactId ? contactsById.get(contactId) : undefined;
  const matches = useMemo(() => search(query).slice(0, 6), [search, query]);

  const dueDate =
    due === "week" ? addDays(today, 7) : due === "twoWeeks" ? addDays(today, 14) : due === "month" ? addDays(today, 30) : due === "pick" ? pickedDate || null : null;

  const choosePerson = (id: string) => {
    setContactId(id);
    setCreating(false);
    setErrors((e) => ({ ...e, contactId: "" }));
    window.setTimeout(() => amountRef.current?.focus(), 50);
  };

  const startNewPerson = () => {
    setCreating(true);
    setContactId(null);
    if (query && !/\d{3,}/.test(query)) setNewName(query);
    else if (query) setNewPhone(query);
  };

  // A phone-book pick reuses the existing person with that number, else fills in a new one.
  const applyPickedContact = (picked: PickedContact) => {
    const existing = picked.e164 ? people.find((p) => p.contact.phone === picked.e164) : undefined;
    if (existing) {
      choosePerson(existing.contact.id);
      return;
    }
    setCreating(true);
    setContactId(null);
    if (picked.name) setNewName(picked.name);
    setNewPhone(picked.phone);
    setErrors((e) => ({ ...e, name: "", phone: "", contactId: "" }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const nextErrors: Record<string, string> = {};

    let personData: { name: string; phone: string } | null = null;
    if (creating) {
      const person = validate(contactInputSchema, { name: newName, phone: newPhone });
      if (!person.ok) Object.assign(nextErrors, person.errors);
      else personData = person.data;
    } else if (!contactId) {
      nextErrors.contactId = "errors.contactRequired";
    }

    const entry = validate(transactionInputSchema, {
      contactId: contactId ?? "pending",
      type,
      amount,
      note,
      category: category ? t(`categories.${category}` as TranslationKey) : null,
      dueDate,
      reminderEnabled: Boolean(dueDate) && reminder,
    });
    if (!entry.ok) Object.assign(nextErrors, entry.errors);

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !entry.ok) {
      if (nextErrors.amount) amountRef.current?.focus();
      return;
    }

    setSubmitting(true);
    const onLateError = (error: unknown) => toast.error(describeError(t, error));
    try {
      let id = contactId;
      let name = selected?.name ?? "";
      if (creating && personData) {
        const created = await createContact(db, uid, personData, { onLateError });
        id = created.id;
        name = created.name;
        analytics.track("person_created", { source: "add_hisab" });
      }
      const result = await createTransaction(db, uid, { ...entry.data, amount: amount, contactId: id! }, { onLateError });
      analytics.track("transaction_created", {
        type,
        hasDueDate: Boolean(entry.data.dueDate),
        hasNote: Boolean(entry.data.note),
      });
      if (result.outcome === "queued") toast.info(t("errors.offlineWrite"));
      onSaved({ transactionId: result.id, contactId: id!, name, amount: result.data.amount, type });
    } catch (error) {
      toast.error(describeError(t, error));
      setSubmitting(false);
    }
  }

  const err = (key: string) => (errors[key] ? t(errors[key] as TranslationKey) : null);

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {/* Who */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-ink">{t("entryForm.who")}</span>
        {selected && !creating ? (
          <div className="flex items-center gap-3 rounded-[var(--radius-control)] border border-line-strong bg-surface p-2.5 pl-3">
            <PersonAvatar id={selected.id} name={selected.name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-ink">{selected.name}</p>
              <p className="tabular text-[13px] text-muted">{formatPhone(selected.phone)}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setContactId(null)}>
              {t("common.edit")}
            </Button>
          </div>
        ) : creating ? (
          <div className="flex flex-col gap-3 rounded-[var(--radius-control)] bg-sunken p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-bold text-ink">
                <UserPlus size={18} weight="bold" aria-hidden /> {t("entryForm.newPerson")}
              </span>
              {people.length > 0 ? (
                <button type="button" onClick={() => setCreating(false)} className="text-sm font-semibold text-primary">
                  {t("entryForm.pickPerson")}
                </button>
              ) : null}
            </div>
            <PickContactButton onPick={applyPickedContact} />
            <Field label={t("personForm.name")} error={err("name")}>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("personForm.namePlaceholder")}
                autoComplete="off"
                data-autofocus
                maxLength={60}
              />
            </Field>
            <Field label={t("personForm.phone")} hint={t("personForm.phoneHint")} error={err("phone")}>
              <Input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder={t("personForm.phonePlaceholder")}
                type="tel"
                inputMode="tel"
                autoComplete="off"
              />
            </Field>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <PickContactButton onPick={applyPickedContact} />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("people.searchPlaceholder")}
              aria-label={t("entryForm.pickPerson")}
              aria-invalid={errors.contactId ? true : undefined}
              data-autofocus
              autoComplete="off"
            />
            <ul className="flex flex-col" role="listbox" aria-label={t("entryForm.pickPerson")}>
              {matches.map((person) => (
                <li key={person.contact.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onClick={() => choosePerson(person.contact.id)}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-sunken"
                  >
                    <PersonAvatar id={person.contact.id} name={person.contact.name} size="sm" />
                    <span className="min-w-0 flex-1 truncate font-semibold text-ink">{person.contact.name}</span>
                    <span className="tabular text-[13px] text-muted">{formatPhone(person.contact.phone)}</span>
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={startNewPerson}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left font-semibold text-primary hover:bg-sunken"
                >
                  <span className="flex size-9 items-center justify-center rounded-full bg-sunken">
                    <Plus size={18} weight="bold" aria-hidden />
                  </span>
                  {query ? `${t("entryForm.newPerson")}: "${query}"` : t("entryForm.newPerson")}
                </button>
              </li>
            </ul>
            {errors.contactId ? (
              <p role="alert" className="text-sm font-medium text-pay">
                {err("contactId")}
              </p>
            ) : null}
          </div>
        )}
      </div>

      {/* Direction */}
      <div role="radiogroup" aria-label={t("entryForm.direction")} className="grid grid-cols-2 gap-2.5">
        {(["RECEIVABLE", "PAYABLE"] as const).map((option) => {
          const active = type === option;
          const receive = option === "RECEIVABLE";
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setType(option)}
              className={cn(
                "flex min-h-[76px] flex-col items-start justify-between rounded-[var(--radius-control)] border-2 p-3 text-left transition-colors",
                active
                  ? receive
                    ? "border-receive bg-receive-soft"
                    : "border-pay bg-pay-soft"
                  : "border-line bg-surface hover:border-line-strong",
              )}
            >
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full",
                  receive ? "bg-receive text-white dark:text-[#00140c]" : "bg-pay text-white dark:text-[#1a0503]",
                )}
                aria-hidden
              >
                {receive ? <ArrowDownLeft size={16} weight="bold" /> : <ArrowUpRight size={16} weight="bold" />}
              </span>
              <span className="mt-2 text-[15px] leading-tight font-bold text-ink">
                {receive ? t("money.moneyToReceive") : t("money.moneyToPay")}
              </span>
            </button>
          );
        })}
      </div>

      {/* Amount */}
      <Field label={t("entryForm.amount")} error={err("amount")}>
        <AmountInput
          ref={amountRef}
          value={amount}
          onValueChange={setAmount}
          tone={type === "RECEIVABLE" ? "receive" : "pay"}
        />
      </Field>

      <Field label={t("entryForm.note")} optional optionalLabel={t("common.optional")} error={err("note")}>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("entryForm.notePlaceholder")} maxLength={140} />
      </Field>

      {/* Due date */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-ink">{t("entryForm.dueDate")}</span>
        <ChipGroup<DueChoice>
          label={t("entryForm.dueDate")}
          value={due}
          onChange={setDue}
          options={[
            { value: "none", label: t("entryForm.quickDue.none") },
            { value: "week", label: t("entryForm.quickDue.week") },
            { value: "month", label: t("entryForm.quickDue.month") },
            { value: "pick", label: t("entryForm.quickDue.pick") },
          ]}
        />
        {due === "pick" ? (
          <Field label={t("entryForm.dueDate")} error={err("dueDate")} className="mt-1">
            <Input type="date" value={pickedDate} min={today} onChange={(e) => setPickedDate(e.target.value)} />
          </Field>
        ) : null}
        {dueDate && type === "RECEIVABLE" ? (
          <Switch checked={reminder} onChange={setReminder} label={t("entryForm.reminder")} />
        ) : null}
      </div>

      {/* More */}
      <div>
        <button
          type="button"
          aria-expanded={showMore}
          onClick={() => setShowMore((s) => !s)}
          className="flex h-10 items-center gap-1.5 text-sm font-semibold text-body"
        >
          <CaretDown size={16} weight="bold" className={cn("transition-transform", showMore && "rotate-180")} aria-hidden />
          {t("entryForm.more")}
        </button>
        {showMore ? (
          <div className="mt-2 flex flex-col gap-2">
            <span className="text-sm font-semibold text-ink">{t("entryForm.category")}</span>
            <ChipGroup
              label={t("entryForm.category")}
              value={category}
              onChange={(v) => setCategory((c) => (c === v ? null : v))}
              options={CATEGORIES.map((c) => ({ value: c, label: t(`categories.${c}` as TranslationKey) }))}
            />
          </div>
        ) : null}
      </div>

      <Button type="submit" size="lg" variant="primary" block loading={submitting} loadingText={t("common.saving")}>
        {t("entryForm.submit")}
      </Button>
    </form>
  );
}

function SavedView({ saved, onAddAnother, onClose }: { saved: Saved; onAddAnother: () => void; onClose: () => void }) {
  const { t, balances } = useHisab();
  const dialogs = useDialogs();
  const reduce = useReducedMotion();
  const balance = balances.get(saved.contactId);
  const receive = saved.type === "RECEIVABLE";
  const amount = formatINR(saved.amount);
  const firstName = saved.name.split(" ")[0] ?? saved.name;

  return (
    <div className="flex flex-col items-center pt-4 text-center">
      <motion.div
        initial={reduce ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 22 }}
        className="flex size-20 items-center justify-center rounded-full bg-receive-soft text-receive"
      >
        <motion.span
          initial={reduce ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.12, type: "spring", stiffness: 500, damping: 20 }}
        >
          <Check size={40} weight="bold" aria-hidden />
        </motion.span>
      </motion.div>
      <p className="mt-5 text-xl font-extrabold tracking-tight text-ink" role="status">
        {receive
          ? t("entryForm.savedTitle", { amount, name: firstName })
          : t("entryForm.savedPayTitle", { amount, name: firstName })}
      </p>
      {balance && (balance.toReceive > 0 || balance.toPay > 0) ? (
        <p className="tabular mt-1 text-[15px] text-muted">
          {balance.net >= 0
            ? t("money.netReceive", { amount: formatINR(balance.net) })
            : t("money.netPay", { amount: formatINR(-balance.net) })}
        </p>
      ) : null}

      <div className="mt-7 flex w-full flex-col gap-2.5">
        <Button
          variant={receive ? "accent" : "secondary"}
          size="lg"
          block
          icon={<PaperPlaneTilt size={20} weight="bold" />}
          onClick={() => {
            analytics.track("reminder_clicked", { from: "entry_saved" });
            dialogs.open({ type: "reminder", contactId: saved.contactId, kind: "NEW_ENTRY", transactionId: saved.transactionId });
          }}
        >
          {receive ? t("entryForm.sendReminder") : t("entryForm.sendMessage", { name: firstName })}
        </Button>
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="secondary" onClick={onAddAnother} icon={<Plus size={18} weight="bold" />}>
            {t("entryForm.addAnother")}
          </Button>
          <Link href={`/people/${saved.contactId}`} onClick={onClose} className={buttonClasses("secondary", "md")}>
            {t("entryForm.viewPerson")}
          </Link>
        </div>
      </div>
    </div>
  );
}
