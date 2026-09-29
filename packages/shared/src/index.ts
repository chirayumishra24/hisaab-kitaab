export * from "./types";
export * from "./money";
export * from "./phone";
export * from "./dates";
export * from "./calc";
export * from "./people";
export * from "./labels";
export * from "./validation";
export * from "./analytics";
export * from "./theme";
export * from "./i18n";
export * from "./messages/templates";
export * from "./messages/compose";
export * from "./messages/service";

export const APP_VERSION = "0.1.0";

/**
 * HisabKitaab uses its own named Firestore database so its data and security
 * rules stay isolated from other apps in the same Firebase project.
 */
export const FIRESTORE_DATABASE_ID = "hisabkitaab";
