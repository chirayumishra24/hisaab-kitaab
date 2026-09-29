"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AndroidLogo, ArrowCounterClockwise, CaretRight, SignOut } from "@phosphor-icons/react";
import { APP_VERSION, LANGUAGES, type Language, type MessagePrefs, type NotificationPrefs } from "@hisabkitaab/shared";
import { describeError, logOut, restoreContact, updateProfile } from "@hisabkitaab/shared/data";
import { useHisab } from "@hisabkitaab/shared/react";
import { useServices } from "@/components/app/AppServices";
import { Button } from "@/components/ui/Button";
import { ChipGroup } from "@/components/ui/Chips";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Card, PersonAvatar } from "@/components/ui/Display";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";

const APK_URL = process.env.NEXT_PUBLIC_ANDROID_APK_URL;

export default function SettingsPage() {
  const { t, profile, contacts } = useHisab();
  const { db, uid, auth, user } = useServices();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const archived = contacts.filter((c) => c.archived);

  const save = async (patch: Parameters<typeof updateProfile>[2]) => {
    try {
      await updateProfile(db, uid, patch);
      toast.success(t("settings.saved"));
    } catch (error) {
      toast.error(describeError(t, error));
    }
  };

  const notifications: NotificationPrefs = profile?.notificationPrefs ?? { dueReminders: true, weeklySummary: false };
  const messagePrefs: MessagePrefs = profile?.messagePrefs ?? { includeBusinessName: true, defaultChannel: "WHATSAPP" };
  const name = profile?.displayName || user.displayName || "";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <h1 className="text-[28px] font-extrabold tracking-tight text-ink lg:text-[32px]">{t("settings.title")}</h1>

      <Card>
        <Link href="/profile" className="flex items-center gap-4 p-4 sm:p-5">
          <PersonAvatar id={uid} name={name || "?"} size="lg" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-lg font-bold text-ink">{profile?.businessName || name}</span>
            <span className="block truncate text-sm text-muted">{user.email}</span>
          </span>
          <CaretRight size={18} className="text-muted" aria-hidden />
        </Link>
      </Card>

      <SettingsSection title={t("settings.notifications")}>
        <Switch
          checked={notifications.dueReminders}
          onChange={(v) => void save({ notificationPrefs: { ...notifications, dueReminders: v } })}
          label={t("settings.dueReminders")}
          hint={t("settings.dueRemindersHint")}
        />
        <Switch checked={false} disabled onChange={() => undefined} label={t("settings.weeklySummary")} hint={t("settings.weeklySummaryHint")} />
      </SettingsSection>

      <SettingsSection title={t("settings.messages")}>
        <Switch
          checked={messagePrefs.includeBusinessName}
          onChange={(v) => void save({ messagePrefs: { ...messagePrefs, includeBusinessName: v } })}
          label={t("settings.includeBusinessName")}
          hint={t("settings.businessNameHint")}
        />
        <div className="flex flex-col gap-2 py-2">
          <span className="text-[15px] font-semibold text-ink">{t("settings.defaultChannel")}</span>
          <ChipGroup
            label={t("settings.defaultChannel")}
            value={messagePrefs.defaultChannel}
            onChange={(v) => void save({ messagePrefs: { ...messagePrefs, defaultChannel: v } })}
            options={(["WHATSAPP", "SMS", "SHARE"] as const).map((c) => ({ value: c, label: t(`settings.channel.${c}`) }))}
          />
        </div>
      </SettingsSection>

      <SettingsSection title={t("settings.language")}>
        <div className="flex flex-col gap-2 py-2">
          <ChipGroup<Language>
            label={t("settings.language")}
            value={profile?.language ?? "en"}
            onChange={(v) => void save({ language: v })}
            options={LANGUAGES.map((l) => ({ value: l, label: t(`settings.languages.${l}`) }))}
          />
          <p className="text-[13px] text-muted">{t("settings.languageHint")}</p>
        </div>
      </SettingsSection>

      {archived.length > 0 ? (
        <SettingsSection title={t("settings.archived")}>
          <ul className="divide-y divide-line">
            {archived.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5">
                <PersonAvatar id={c.id} name={c.name} size="sm" />
                <span className="min-w-0 flex-1 truncate font-semibold text-ink">{c.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<ArrowCounterClockwise size={16} weight="bold" />}
                  onClick={() =>
                    void restoreContact(db, uid, c.id)
                      .then(() => toast.success(t("people.restored", { name: c.name })))
                      .catch((e) => toast.error(describeError(t, e)))
                  }
                >
                  {t("people.restore")}
                </Button>
              </li>
            ))}
          </ul>
        </SettingsSection>
      ) : null}

      {APK_URL ? (
        <a
          href={APK_URL}
          className="flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)] hover:border-line-strong sm:p-5"
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-receive-soft text-receive">
            <AndroidLogo size={24} weight="fill" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold text-ink">Get the Android app</span>
            <span className="block text-sm text-muted">Same account, same Hisab, on your phone.</span>
          </span>
          <CaretRight size={18} className="text-muted" aria-hidden />
        </a>
      ) : null}

      <Button
        variant="secondary"
        size="lg"
        icon={<SignOut size={20} weight="bold" />}
        onClick={async () => {
          const ok = await confirm({
            title: t("auth.logout"),
            body: t("auth.logoutConfirm"),
            confirmLabel: t("auth.logout"),
            cancelLabel: t("common.cancel"),
          });
          if (!ok) return;
          await logOut(auth);
          router.replace("/login");
        }}
      >
        {t("auth.logout")}
      </Button>
      <p className="text-center text-[13px] text-muted">{t("settings.version", { version: APP_VERSION })}</p>
    </div>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="px-4 py-3 sm:px-5">
      <h2 className="pb-1 text-sm font-bold text-muted">{title}</h2>
      <div className="divide-y divide-line">{children}</div>
    </Card>
  );
}
