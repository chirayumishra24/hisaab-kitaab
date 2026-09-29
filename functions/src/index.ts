/**
 * HisabKitaab Cloud Functions (codebase "hisabkitaab").
 *
 * hkApi - HTTPS API shared by the web and mobile apps:
 *   GET  /api/messages/capabilities  -> { SMS: boolean, WHATSAPP: boolean }
 *   POST /api/messages/send          -> sends a reminder through the configured gateway
 *
 * Served directly and through the Hosting rewrite /api/** on hisabkitaab-ideathon.web.app.
 */
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { z } from "zod";
import { FIRESTORE_DATABASE_ID, SERVER_CHANNELS, type SendApiResponse } from "@hisabkitaab/shared";
import { finishLog, loadMessage, rateLimited, serverProviders, startLog } from "./messaging";

setGlobalOptions({ region: "asia-south1", maxInstances: 10, memory: "256MiB" });

const app = initializeApp();
const db = getFirestore(app, FIRESTORE_DATABASE_ID);
const auth = getAuth(app);

const sendSchema = z.object({
  channel: z.enum(SERVER_CHANNELS),
  kind: z.enum(["REMINDER", "NEW_ENTRY"]),
  contactId: z.string().min(1).max(128),
  transactionId: z.string().min(1).max(128).nullable(),
});

type Res = { status(code: number): Res; json(body: unknown): void; set(key: string, value: string): Res };

function reply(res: Res, code: number, body: SendApiResponse) {
  res.set("Cache-Control", "no-store").status(code).json(body);
}

export const hkApi = onRequest({ cors: true, invoker: "public" }, async (req, res) => {
  const path = req.path.replace(/\/+$/, "");

  if (req.method === "GET" && path.endsWith("/messages/capabilities")) {
    const providers = serverProviders();
    res.set("Cache-Control", "public, max-age=60").json({ SMS: Boolean(providers.SMS), WHATSAPP: Boolean(providers.WHATSAPP) });
    return;
  }

  if (req.method === "POST" && path.endsWith("/messages/send")) {
    const token = req.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return reply(res, 401, { status: "FAILED", error: "Sign in again to send messages." });

    let uid: string;
    try {
      uid = (await auth.verifyIdToken(token)).uid;
    } catch {
      return reply(res, 401, { status: "FAILED", error: "Sign in again to send messages." });
    }

    const parsed = sendSchema.safeParse(req.body);
    if (!parsed.success) return reply(res, 400, { status: "FAILED", error: "Invalid request." });
    const { channel, kind, contactId, transactionId } = parsed.data;

    const provider = serverProviders()[channel];
    if (!provider) return reply(res, 400, { status: "FAILED", error: `${channel} is not set up on this server.` });
    if (await rateLimited(db, uid)) return reply(res, 429, { status: "FAILED", error: "Too many messages. Try again later." });

    const loaded = await loadMessage(db, uid, kind, contactId, transactionId);
    if (!loaded.ok) return reply(res, loaded.status, { status: "FAILED", error: loaded.error });

    const logRef = await startLog(db, uid, {
      contactId,
      transactionId,
      kind,
      channel,
      to: loaded.contact.phone,
      body: loaded.body,
      provider: provider.name,
    });

    const result = await provider.send(loaded.contact.phone, loaded.body);
    const status = result.ok ? (result.simulated ? "SIMULATED" : "SENT") : "FAILED";
    await finishLog(db, uid, logRef, {
      contactId,
      transactionId,
      status,
      error: result.ok ? null : result.error,
      providerMessageId: result.ok ? result.id : null,
    });

    if (!result.ok) {
      logger.warn("Message send failed", { channel, provider: provider.name, error: result.error });
      return reply(res, 502, { status: "FAILED", error: result.error });
    }
    return reply(res, 200, { status, messageId: logRef.id });
  }

  res.status(404).json({ error: "Not found" });
});
