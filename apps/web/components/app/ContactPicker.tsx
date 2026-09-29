"use client";

import { useCallback, useSyncExternalStore } from "react";
import { AddressBook } from "@phosphor-icons/react";
import { formatPhone, normalizePhone } from "@hisabkitaab/shared";
import { useHisab } from "@hisabkitaab/shared/react";
import { hisabNative } from "@/lib/native";
import { cn } from "../ui/cn";
import { useToast } from "../ui/Toast";

export interface PickedContact {
  name: string;
  /** Formatted for the input ("+91 98765 43210") when valid, otherwise as stored in the phone book. */
  phone: string;
  /** E.164, or null when the phone book number is not a valid mobile number. */
  e164: string | null;
}

/** Chrome on Android exposes the Contact Picker API; the Android app uses our native plugin. */
type WebContacts = { select(props: string[], options?: { multiple?: boolean }): Promise<{ name?: string[]; tel?: string[] }[]> };

function webContacts(): WebContacts | null {
  if (typeof navigator === "undefined") return null;
  const contacts = (navigator as unknown as { contacts?: WebContacts }).contacts;
  return contacts && typeof contacts.select === "function" ? contacts : null;
}

const canPick = () => hisabNative() !== null || webContacts() !== null;
const noopSubscribe = () => () => undefined;

export function useContactPicker() {
  const { t } = useHisab();
  const toast = useToast();
  const available = useSyncExternalStore(noopSubscribe, canPick, () => false);

  const pick = useCallback(async (): Promise<PickedContact | null> => {
    let name = "";
    let raw = "";
    try {
      const native = hisabNative();
      if (native) {
        const result = await native.pickContact();
        if (result.cancelled) return null;
        name = result.name ?? "";
        raw = result.phone ?? "";
      } else {
        const web = webContacts();
        if (!web) return null;
        const [first] = await web.select(["name", "tel"], { multiple: false });
        if (!first) return null;
        name = first.name?.[0] ?? "";
        raw = first.tel?.[0] ?? "";
      }
    } catch {
      toast.error(t("personForm.contactsError"));
      return null;
    }
    const e164 = normalizePhone(raw);
    return { name: name.trim().slice(0, 60), phone: e164 ? formatPhone(e164) : raw, e164 };
  }, [t, toast]);

  return { available, pick };
}

export function PickContactButton({
  onPick,
  className,
  compact,
}: {
  onPick: (contact: PickedContact) => void;
  className?: string;
  compact?: boolean;
}) {
  const { t } = useHisab();
  const { available, pick } = useContactPicker();
  if (!available) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        const contact = await pick();
        if (contact) onPick(contact);
      }}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold text-primary transition-colors active:scale-[0.98]",
        compact
          ? "h-9 rounded-full px-3 text-sm hover:bg-surface"
          : "h-12 w-full rounded-[var(--radius-control)] border border-dashed border-line-strong bg-surface text-[15px] hover:bg-sunken",
        className,
      )}
    >
      <AddressBook size={compact ? 18 : 20} weight="bold" aria-hidden />
      {t("personForm.fromContacts")}
    </button>
  );
}
