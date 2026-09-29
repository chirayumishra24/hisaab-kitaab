/**
 * MessageService: one entry point for sending reminders, independent of how
 * they are delivered. Providers are plugged in per platform:
 *
 *   MessageProvider
 *    ├── ServerProvider (SMS)        -> our API -> Twilio / other SMS gateway
 *    ├── ServerProvider (WHATSAPP)   -> our API -> WhatsApp Business provider
 *    ├── WhatsAppLinkProvider        -> opens wa.me with the text filled in
 *    ├── SmsLinkProvider             -> opens the phone's SMS app
 *    ├── ShareProvider               -> native share sheet
 *    └── CopyProvider                -> clipboard
 *
 * Honesty rule: only a server provider that got an accepted response from the
 * gateway may report SENT. Device channels report SHARED because we cannot
 * know whether the user actually pressed send.
 */
import type { DeviceChannel, MessageChannel, MessageKind, MessageStatus, ServerChannel } from "../types";
import { smsUrl, whatsappUrl } from "./templates";

export interface OutgoingMessage {
  kind: MessageKind;
  contactId: string;
  transactionId: string | null;
  /** E.164 phone number. */
  to: string;
  body: string;
}

export interface SendResult {
  channel: MessageChannel;
  status: Extract<MessageStatus, "SENT" | "FAILED" | "SHARED" | "SIMULATED">;
  /** Translation-friendly short reason when FAILED. */
  error?: string;
  /** True when the user dismissed a share sheet without choosing an app. */
  cancelled?: boolean;
}

export interface MessageProvider {
  readonly channel: MessageChannel;
  isAvailable(): boolean | Promise<boolean>;
  send(message: OutgoingMessage): Promise<SendResult>;
}

/** Persists the outcome of device-side sends (server sends are logged by the server). */
export type MessageRecorder = (message: OutgoingMessage, result: SendResult) => Promise<void>;

export class MessageService {
  private readonly providers = new Map<MessageChannel, MessageProvider>();

  constructor(
    providers: MessageProvider[],
    private readonly recorder?: MessageRecorder,
  ) {
    for (const provider of providers) this.providers.set(provider.channel, provider);
  }

  /** Channels that can be used right now, in the order providers were registered. */
  async availableChannels(): Promise<MessageChannel[]> {
    const checks = await Promise.all(
      [...this.providers.values()].map(async (p) => {
        try {
          return (await p.isAvailable()) ? p.channel : null;
        } catch {
          return null;
        }
      }),
    );
    return checks.filter((c): c is MessageChannel => c !== null);
  }

  async send(channel: MessageChannel, message: OutgoingMessage): Promise<SendResult> {
    const provider = this.providers.get(channel);
    if (!provider) return { channel, status: "FAILED", error: "Channel not configured" };
    let result: SendResult;
    try {
      result = await provider.send(message);
    } catch (error) {
      result = { channel, status: "FAILED", error: error instanceof Error ? error.message : "Unknown error" };
    }
    if (this.recorder && isDeviceChannel(channel) && !result.cancelled && result.status !== "FAILED") {
      // Recording failures must not hide a successful share from the user.
      await this.recorder(message, result).catch(() => undefined);
    }
    return result;
  }
}

export function isDeviceChannel(channel: MessageChannel): channel is DeviceChannel {
  return channel === "WHATSAPP_LINK" || channel === "SMS_LINK" || channel === "SHARE" || channel === "COPY";
}

/* ----------------------------- device providers ----------------------------- */

export function createWhatsAppLinkProvider(openUrl: (url: string) => Promise<void>): MessageProvider {
  return {
    channel: "WHATSAPP_LINK",
    isAvailable: () => true,
    async send(message) {
      await openUrl(whatsappUrl(message.to, message.body));
      return { channel: "WHATSAPP_LINK", status: "SHARED" };
    },
  };
}

export function createSmsLinkProvider(
  openUrl: (url: string) => Promise<void>,
  isAvailable: () => boolean | Promise<boolean> = () => true,
): MessageProvider {
  return {
    channel: "SMS_LINK",
    isAvailable,
    async send(message) {
      await openUrl(smsUrl(message.to, message.body));
      return { channel: "SMS_LINK", status: "SHARED" };
    },
  };
}

/** `share` resolves true when the user picked a target, false when they dismissed the sheet. */
export function createShareProvider(
  share: (text: string) => Promise<boolean>,
  isAvailable: () => boolean | Promise<boolean> = () => true,
): MessageProvider {
  return {
    channel: "SHARE",
    isAvailable,
    async send(message) {
      const completed = await share(message.body);
      return { channel: "SHARE", status: "SHARED", cancelled: !completed };
    },
  };
}

export function createCopyProvider(copy: (text: string) => Promise<void>): MessageProvider {
  return {
    channel: "COPY",
    isAvailable: () => true,
    async send(message) {
      await copy(message.body);
      return { channel: "COPY", status: "SHARED" };
    },
  };
}

/* ------------------------------ server provider ----------------------------- */

export interface ServerProviderOptions {
  /** Base URL of the web app that hosts /api/messages (empty string = same origin). */
  baseUrl: string;
  getIdToken: () => Promise<string | null>;
  /** Which server channels are configured; usually from GET /api/messages/capabilities. */
  capabilities: () => Promise<Record<ServerChannel, boolean>>;
  fetchImpl?: typeof fetch;
}

export interface SendApiRequest {
  channel: ServerChannel;
  kind: MessageKind;
  contactId: string;
  transactionId: string | null;
}

export interface SendApiResponse {
  status: SendResult["status"];
  error?: string;
  messageId?: string;
}

/**
 * Sends through our backend. The server rebuilds the message from the user's
 * own Firestore data, so the client can't use this to text arbitrary content.
 */
export function createServerProvider(channel: ServerChannel, options: ServerProviderOptions): MessageProvider {
  const doFetch = options.fetchImpl ?? fetch;
  return {
    channel,
    isAvailable: async () => (await options.capabilities())[channel] === true,
    async send(message) {
      const token = await options.getIdToken();
      if (!token) return { channel, status: "FAILED", error: "Not signed in" };
      const payload: SendApiRequest = {
        channel,
        kind: message.kind,
        contactId: message.contactId,
        transactionId: message.transactionId,
      };
      let response: Response;
      try {
        response = await doFetch(`${options.baseUrl}/api/messages/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
      } catch {
        return { channel, status: "FAILED", error: "Network error" };
      }
      const data = (await response.json().catch(() => null)) as SendApiResponse | null;
      if (!response.ok || !data) {
        return { channel, status: "FAILED", error: data?.error ?? `Server error (${response.status})` };
      }
      return { channel, status: data.status, ...(data.error ? { error: data.error } : {}) };
    },
  };
}

/** Fetches (and caches for a minute) which server channels are configured. */
export function createCapabilitiesLoader(baseUrl: string, fetchImpl: typeof fetch = fetch) {
  let cache: { at: number; value: Record<ServerChannel, boolean> } | null = null;
  return async (): Promise<Record<ServerChannel, boolean>> => {
    if (cache && Date.now() - cache.at < 60_000) return cache.value;
    try {
      const response = await fetchImpl(`${baseUrl}/api/messages/capabilities`);
      if (!response.ok) throw new Error(String(response.status));
      const value = (await response.json()) as Record<ServerChannel, boolean>;
      cache = { at: Date.now(), value: { SMS: value.SMS === true, WHATSAPP: value.WHATSAPP === true } };
    } catch {
      // Without the API (e.g. offline, or mobile without API URL) only device channels are offered.
      cache = { at: Date.now(), value: { SMS: false, WHATSAPP: false } };
    }
    return cache.value;
  };
}
