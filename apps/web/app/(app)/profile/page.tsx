"use client";

import { useState } from "react";
import { formatPhone, profileUpdateSchema, validate, type TranslationKey } from "@hisabkitaab/shared";
import { describeError, updateProfile } from "@hisabkitaab/shared/data";
import { useHisab } from "@hisabkitaab/shared/react";
import { useServices } from "@/components/app/AppServices";
import { Button } from "@/components/ui/Button";
import { Card, PersonAvatar, Skeleton } from "@/components/ui/Display";
import { Field, Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

export default function ProfilePage() {
  const { t, profile } = useHisab();
  const { user } = useServices();
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <h1 className="text-[28px] font-extrabold tracking-tight text-ink lg:text-[32px]">{t("settings.profile")}</h1>
      <Card className="p-5 sm:p-6">
        {profile ? (
          <ProfileForm
            key={profile.updatedAt}
            uid={user.uid}
            email={user.email ?? profile.email}
            initial={{
              displayName: profile.displayName,
              businessName: profile.businessName ?? "",
              phone: profile.phone ? formatPhone(profile.phone) : "",
            }}
          />
        ) : (
          <div className="flex flex-col gap-4" aria-busy>
            <Skeleton className="size-16 rounded-full" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        )}
      </Card>
    </div>
  );
}

function ProfileForm({
  uid,
  email,
  initial,
}: {
  uid: string;
  email: string;
  initial: { displayName: string; businessName: string; phone: string };
}) {
  const { t } = useHisab();
  const { db } = useServices();
  const toast = useToast();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));
  const err = (key: string) => (errors[key] ? t(errors[key] as TranslationKey) : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = validate(profileUpdateSchema, values);
    if (!result.ok) {
      setErrors(result.errors as Record<string, string>);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await updateProfile(db, uid, values);
      toast.success(t("settings.saved"));
    } catch (error) {
      toast.error(describeError(t, error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <PersonAvatar id={uid} name={values.displayName || "?"} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-ink">{values.businessName || values.displayName}</p>
          <p className="truncate text-sm text-muted">{email}</p>
        </div>
      </div>
      <Field label={t("settings.displayName")} error={err("displayName")}>
        <Input value={values.displayName} onChange={set("displayName")} autoComplete="name" maxLength={60} />
      </Field>
      <Field
        label={t("settings.businessName")}
        hint={t("settings.businessNameHint")}
        optional
        optionalLabel={t("common.optional")}
        error={err("businessName")}
      >
        <Input value={values.businessName} onChange={set("businessName")} placeholder="e.g. Sharma Kirana Store" maxLength={60} />
      </Field>
      <Field label={t("settings.phone")} optional optionalLabel={t("common.optional")} error={err("phone")}>
        <Input value={values.phone} onChange={set("phone")} type="tel" inputMode="tel" autoComplete="tel" />
      </Field>
      <Field label={t("settings.email")}>
        <Input value={email} disabled readOnly />
      </Field>
      <Button type="submit" size="lg" loading={saving} loadingText={t("common.saving")}>
        {t("common.save")}
      </Button>
    </form>
  );
}
