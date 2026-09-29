/**
 * Minimal, privacy-respecting product analytics.
 * Event properties are typed so that names, phone numbers, notes and exact
 * amounts can never be attached by accident. Plug a real sink (Firebase
 * Analytics, PostHog…) in each app; the default does nothing.
 */
import type { MessageChannel, TransactionType } from "./types";

export interface AnalyticsEvents {
  signup_completed: Record<string, never>;
  login_completed: Record<string, never>;
  person_created: { source: "people" | "add_hisab" };
  transaction_created: { type: TransactionType; hasDueDate: boolean; hasNote: boolean };
  transaction_paid: { type: TransactionType; full: boolean };
  reminder_clicked: { from: "dashboard" | "person" | "entry_saved" | "entry" };
  reminder_sent: { channel: MessageChannel };
  reminder_failed: { channel: MessageChannel };
}

export type AnalyticsEventName = keyof AnalyticsEvents;

export type AnalyticsSink = <E extends AnalyticsEventName>(event: E, props: AnalyticsEvents[E]) => void;

export interface Analytics {
  track<E extends AnalyticsEventName>(event: E, ...props: AnalyticsEvents[E] extends Record<string, never> ? [] : [AnalyticsEvents[E]]): void;
}

export function createAnalytics(sinks: AnalyticsSink[] = []): Analytics {
  return {
    track(event, ...rest) {
      const props = (rest[0] ?? {}) as AnalyticsEvents[typeof event];
      for (const sink of sinks) {
        try {
          sink(event, props);
        } catch {
          // Analytics must never break the product.
        }
      }
    },
  };
}

/** Logs events to the console; handy in development. */
export const consoleSink: AnalyticsSink = (event, props) => {
  console.debug(`[analytics] ${event}`, props);
};
