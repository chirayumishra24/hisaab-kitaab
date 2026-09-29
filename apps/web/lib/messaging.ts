"use client";

import { useMemo } from "react";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import {
  createCapabilitiesLoader,
  createCopyProvider,
  createServerProvider,
  createShareProvider,
  createSmsLinkProvider,
  createWhatsAppLinkProvider,
  MessageService,
  type DeviceChannel,
} from "@hisabkitaab/shared";
import { recordDeviceShare } from "@hisabkitaab/shared/data";

/**
 * Base URL of the HisabKitaab API (Cloud Function hkApi, also reachable via the
 * Hosting rewrite https://hisabkitaab-ideathon.web.app/api/**).
 */
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");

const capabilities = createCapabilitiesLoader(API_BASE_URL);

function isTouchDevice() {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  if (!ok) throw new Error("Copy not supported");
}

/** MessageService wired for the browser: server SMS/WhatsApp when configured, otherwise device fallbacks. */
export function createWebMessageService(auth: Auth, db: Firestore, uid: string) {
  const getIdToken = async () => (auth.currentUser ? auth.currentUser.getIdToken() : null);
  const openUrl = async (url: string) => {
    // "noopener" would make window.open return null, so detach the opener manually.
    const win = window.open(url, "_blank");
    if (win) win.opener = null;
    else window.location.href = url;
  };
  return new MessageService(
    [
      createServerProvider("SMS", { baseUrl: API_BASE_URL, getIdToken, capabilities }),
      createServerProvider("WHATSAPP", { baseUrl: API_BASE_URL, getIdToken, capabilities }),
      createWhatsAppLinkProvider(openUrl),
      createSmsLinkProvider(async (url) => {
        window.location.href = url;
      }, isTouchDevice),
      createShareProvider(
        async (text) => {
          try {
            await navigator.share({ text });
            return true;
          } catch (error) {
            if ((error as DOMException).name === "AbortError") return false;
            throw error;
          }
        },
        () => typeof navigator !== "undefined" && typeof navigator.share === "function",
      ),
      createCopyProvider(copyText),
    ],
    (message, result) =>
      recordDeviceShare(db, uid, {
        contactId: message.contactId,
        transactionId: message.transactionId,
        kind: message.kind,
        channel: result.channel as DeviceChannel,
        to: message.to,
        body: message.body,
      }),
  );
}

export function useWebMessageService(auth: Auth, db: Firestore, uid: string) {
  return useMemo(() => createWebMessageService(auth, db, uid), [auth, db, uid]);
}
