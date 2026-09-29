"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { createTranslator, loginSchema, signUpSchema, validate, type TranslationKey } from "@hisabkitaab/shared";
import { describeError, logIn, requestPasswordReset, signUp } from "@hisabkitaab/shared/data";
import { analytics } from "@/lib/analytics";
import { getFirebase } from "@/lib/firebase";
import { Button } from "../ui/Button";
import { Field, Input } from "../ui/Field";

const t = createTranslator("en");

function PasswordInput({
  value,
  onChange,
  autoComplete,
  ...aria
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        {...aria}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="pr-12"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("auth.hidePassword") : t("auth.showPassword")}
        className="absolute top-1/2 right-1 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-sunken"
      >
        {visible ? <EyeSlash size={20} /> : <Eye size={20} />}
      </button>
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-pay-soft px-4 py-3 text-sm font-semibold text-pay">
      {message}
    </p>
  );
}

const fieldError = (errors: Record<string, string>, key: string) =>
  errors[key] ? t(errors[key] as TranslationKey) : null;

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const result = validate(loginSchema, { email, password });
    if (!result.ok) {
      setErrors(result.errors as Record<string, string>);
      return;
    }
    setErrors({});
    setFormError(null);
    setBusy(true);
    try {
      await logIn(getFirebase().auth, result.data);
      analytics.track("login_completed");
    } catch (error) {
      setFormError(describeError(t, error));
      setBusy(false);
    }
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <div className="mb-2">
        <h1 className="text-[28px] font-extrabold tracking-tight text-ink">{t("auth.loginTitle")}</h1>
        <p className="mt-1 text-body">{t("auth.loginSubtitle")}</p>
      </div>
      <FormError message={formError} />
      <Field label={t("auth.email")} error={fieldError(errors, "email")}>
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("auth.emailPlaceholder")}
        />
      </Field>
      <Field label={t("auth.password")} error={fieldError(errors, "password")}>
        <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
      </Field>
      <Link href="/forgot-password" className="-mt-1 self-end text-sm font-bold text-primary underline-offset-4 hover:underline">
        {t("auth.forgot")}
      </Link>
      <Button type="submit" size="lg" block loading={busy} loadingText={t("common.loading")}>
        {t("auth.login")}
      </Button>
      <p className="text-center text-[15px] text-body">
        {t("auth.noAccount")}{" "}
        <Link href="/signup" className="font-bold text-primary underline-offset-4 hover:underline">
          {t("auth.signup")}
        </Link>
      </p>
    </form>
  );
}

export function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const result = validate(signUpSchema, { name, email, password });
    if (!result.ok) {
      setErrors(result.errors as Record<string, string>);
      return;
    }
    setErrors({});
    setFormError(null);
    setBusy(true);
    try {
      const { auth, db } = getFirebase();
      await signUp(auth, db, { name, email, password });
      analytics.track("signup_completed");
    } catch (error) {
      setFormError(describeError(t, error));
      setBusy(false);
    }
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <div className="mb-2">
        <h1 className="text-[28px] font-extrabold tracking-tight text-ink">{t("auth.signupTitle")}</h1>
        <p className="mt-1 text-body">{t("auth.signupSubtitle")}</p>
      </div>
      <FormError message={formError} />
      <Field label={t("auth.name")} error={fieldError(errors, "name")}>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder={t("auth.namePlaceholder")} maxLength={60} />
      </Field>
      <Field label={t("auth.email")} error={fieldError(errors, "email")}>
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("auth.emailPlaceholder")}
        />
      </Field>
      <Field label={t("auth.password")} hint={t("auth.passwordHint")} error={fieldError(errors, "password")}>
        <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
      </Field>
      <Button type="submit" size="lg" variant="accent" block loading={busy} loadingText={t("common.loading")}>
        {t("auth.signup")}
      </Button>
      <p className="text-center text-[15px] text-body">
        {t("auth.haveAccount")}{" "}
        <Link href="/login" className="font-bold text-primary underline-offset-4 hover:underline">
          {t("auth.login")}
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const result = validate(loginSchema.pick({ email: true }), { email });
    if (!result.ok) {
      setError(t((result.errors.email ?? "errors.emailInvalid") as TranslationKey));
      return;
    }
    setError(null);
    setFormError(null);
    setBusy(true);
    try {
      await requestPasswordReset(getFirebase().auth, result.data.email);
      setSentTo(result.data.email);
    } catch (err) {
      setFormError(describeError(t, err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <div className="mb-2">
        <h1 className="text-[28px] font-extrabold tracking-tight text-ink">{t("auth.resetTitle")}</h1>
        <p className="mt-1 text-body">{t("auth.resetSubtitle")}</p>
      </div>
      <FormError message={formError} />
      {sentTo ? (
        <p role="status" className="rounded-xl bg-receive-soft px-4 py-3 text-[15px] font-semibold text-receive">
          {t("auth.resetSent", { email: sentTo })}
        </p>
      ) : (
        <>
          <Field label={t("auth.email")} error={error}>
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.emailPlaceholder")}
            />
          </Field>
          <Button type="submit" size="lg" block loading={busy} loadingText={t("common.loading")}>
            {t("auth.resetSend")}
          </Button>
        </>
      )}
      <Link href="/login" className="text-center text-[15px] font-bold text-primary underline-offset-4 hover:underline">
        {t("auth.backToLogin")}
      </Link>
    </form>
  );
}
