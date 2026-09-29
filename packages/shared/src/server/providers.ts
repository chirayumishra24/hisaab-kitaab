/**
 * Server-side delivery providers. These hold credentials and must only ever
 * be imported from server code (API routes / Cloud Functions).
 *
 * Add a new gateway (MSG91, Gupshup, Meta Cloud API…) by implementing
 * GatewayProvider and wiring it in `providersFromEnv`.
 */
import type { ServerChannel } from "../types";

export type GatewayResult =
  | { ok: true; id: string | null; simulated?: boolean }
  | { ok: false; error: string; retryable: boolean };

export interface GatewayProvider {
  readonly name: string;
  readonly channel: ServerChannel;
  send(toE164: string, body: string): Promise<GatewayResult>;
}

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  /** E.164 sender number, or a Messaging Service SID starting with "MG". */
  from: string;
  fetchImpl?: typeof fetch;
}

function base64(value: string): string {
  if (typeof btoa === "function") return btoa(value);
  // Node < 16 fallback; kept dependency-free.
  return (globalThis as unknown as { Buffer: { from(v: string): { toString(e: string): string } } }).Buffer.from(
    value,
  ).toString("base64");
}

/** Twilio Programmable Messaging over plain REST (SMS or WhatsApp). */
export function createTwilioProvider(channel: ServerChannel, config: TwilioConfig): GatewayProvider {
  const doFetch = config.fetchImpl ?? fetch;
  const prefix = channel === "WHATSAPP" ? "whatsapp:" : "";
  return {
    name: "twilio",
    channel,
    async send(to, body) {
      const form = new URLSearchParams({ To: `${prefix}${to}`, Body: body });
      if (config.from.startsWith("MG")) form.set("MessagingServiceSid", config.from);
      else form.set("From", `${prefix}${config.from}`);
      try {
        const response = await doFetch(
          `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.accountSid)}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${base64(`${config.accountSid}:${config.authToken}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: form.toString(),
          },
        );
        const data = (await response.json().catch(() => ({}))) as { sid?: string; message?: string };
        if (!response.ok) {
          return { ok: false, error: data.message ?? `Twilio error ${response.status}`, retryable: response.status >= 500 };
        }
        return { ok: true, id: data.sid ?? null };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Network error", retryable: true };
      }
    },
  };
}

/**
 * Development provider. It never delivers anything and its result is stored
 * as SIMULATED, so the UI can't mistake it for a real send.
 */
export function createMockProvider(channel: ServerChannel, log: (line: string) => void = console.info): GatewayProvider {
  return {
    name: "mock",
    channel,
    async send(to, body) {
      log(`[mock ${channel}] to ${to}:\n${body}`);
      return { ok: true, id: null, simulated: true };
    },
  };
}

export type ProviderEnv = Record<string, string | undefined>;

/**
 * Reads provider configuration from environment variables:
 *   SMS_PROVIDER       = twilio | mock | (unset = disabled)
 *   WHATSAPP_PROVIDER  = twilio | mock | (unset = disabled)
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM, TWILIO_WHATSAPP_FROM
 */
export function providersFromEnv(env: ProviderEnv): Partial<Record<ServerChannel, GatewayProvider>> {
  const out: Partial<Record<ServerChannel, GatewayProvider>> = {};
  const setup = (channel: ServerChannel, kind: string | undefined, from: string | undefined) => {
    if (kind === "mock") out[channel] = createMockProvider(channel);
    if (kind === "twilio" && env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && from) {
      out[channel] = createTwilioProvider(channel, {
        accountSid: env.TWILIO_ACCOUNT_SID,
        authToken: env.TWILIO_AUTH_TOKEN,
        from,
      });
    }
  };
  setup("SMS", env.SMS_PROVIDER?.trim().toLowerCase(), env.TWILIO_SMS_FROM);
  setup("WHATSAPP", env.WHATSAPP_PROVIDER?.trim().toLowerCase(), env.TWILIO_WHATSAPP_FROM);
  return out;
}
