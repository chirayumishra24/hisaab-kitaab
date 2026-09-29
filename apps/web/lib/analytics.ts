import { consoleSink, createAnalytics } from "@hisabkitaab/shared";

/**
 * Product analytics. Only event names and non-identifying properties are sent
 * (see AnalyticsEvents). Plug a real sink here, e.g. Firebase Analytics logEvent.
 */
export const analytics = createAnalytics(process.env.NODE_ENV === "development" ? [consoleSink] : []);
