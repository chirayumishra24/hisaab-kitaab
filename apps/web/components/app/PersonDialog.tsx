"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { contactInputSchema, formatPhone, validate, type TranslationKey } from "@hisabkitaab/shared";
import { createContact, describeError, updateContact } from "@hisabkitaab/shared/data";
import { useHisab } from "@hisabkitaab/shared/react";
import { analytics } from "@/lib/analytics";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Field, Input, Textarea } from "../ui/Field";
import { useToast } from "../ui/Toast";
import { useServices } from "./AppServices";
import { useDialogs, type DialogRequest } from "./DialogsProvider";

export function PersonDialog({
  request,
  onClose,
}: {
  request: Extract<DialogRequest, { type: "person" }> | null;
  onClose: () => void;
}) {
  const { t } = useHisab();
  const editing = Boolean(request?.contactId);
  return (
    <Dialog
      open={request !== null}
      onClose={onClose}
      title={editing ? t("personForm.editTitle") : t("personForm.title")}
      closeLabel={t("common.close")}
    >
      {request ? <PersonForm contactId={request.contactId} onDone={onClose} /> : null}
    </Dialog>
  );
}

function PersonForm({ contactId, onDone }: { contactId?: string; onDone: () => void }) {
  const { t, contactsById } = useHisab();
  const { db, uid } = useServices();
  const toast = useToast();
  const dialogs = useDialogs();
  const router = useRouter();
  const existing = contactId ? contactsById.get(contactId) : undefined;

  const [name, setName] = useState(existing?.name ?? "");
  const [phone, setPhone] = useState(existing ? formatPhone(existing.phone) : "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<"save" | "saveAndAdd" | null>(null);

  const err = (key: string) => (errors[key] ? t(errors[key] as TranslationKey) : null);

  async function save(then: "save" | "saveAndAdd") {
    if (submitting) return;
    const input = { name, phone, email, notes };
    const result = validate(contactInputSchema, input);
    if (!result.ok) {
      setErrors(result.errors as Record<string, string>);
      return;
    }
    setErrors({});
    setSubmitting(then);
    const onLateError = (error: unknown) => toast.error(describeError(t, error));
    try {
      if (existing) {
        const { outcome } = await updateContact(db, uid, existing.id, input, { onLateError });
        toast.success(t("people.updated"));
        if (outcome === "queued") toast.info(t("errors.offlineWrite"));
        onDone();
        return;
      }
      const created = await createContact(db, uid, input, { onLateError });
      analytics.track("person_created", { source: "people" });
      if (created.outcome === "queued") toast.info(t("errors.offlineWrite"));
      if (then === "saveAndAdd") {
        dialogs.open({ type: "addHisab", contactId: created.id });
      } else {
        toast.success(t("people.created", { name: created.name }));
        onDone();
        router.push(`/people/${created.id}`);
      }
    } catch (error) {
      toast.error(describeError(t, error));
      setSubmitting(null);
    }
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save(existing ? "save" : "saveAndAdd");
      }}
      className="flex flex-col gap-4"
    >
      <Field label={t("personForm.name")} error={err("name")}>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("personForm.namePlaceholder")}
          autoComplete="off"
          maxLength={60}
          data-autofocus
        />
      </Field>
      <Field label={t("personForm.phone")} hint={t("personForm.phoneHint")} error={err("phone")}>
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t("personForm.phonePlaceholder")}
          type="tel"
          inputMode="tel"
          autoComplete="off"
        />
      </Field>
      <Field label={t("personForm.email")} optional optionalLabel={t("common.optional")} error={err("email")}>
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("personForm.emailPlaceholder")}
          type="email"
          inputMode="email"
          autoComplete="off"
        />
      </Field>
      <Field label={t("personForm.notes")} optional optionalLabel={t("common.optional")} error={err("notes")}>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("personForm.notesPlaceholder")}
          maxLength={280}
        />
      </Field>
      <div className="mt-1 flex flex-col gap-2.5">
        {existing ? (
          <Button type="submit" size="lg" block loading={submitting === "save"} loadingText={t("common.saving")}>
            {t("common.save")}
          </Button>
        ) : (
          <>
            <Button type="submit" size="lg" block loading={submitting === "saveAndAdd"} loadingText={t("common.saving")}>
              {t("personForm.submitAndAdd")}
            </Button>
            <Button
              variant="secondary"
              block
              disabled={submitting !== null}
              loading={submitting === "save"}
              loadingText={t("common.saving")}
              onClick={() => void save("save")}
            >
              {t("personForm.submit")}
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
