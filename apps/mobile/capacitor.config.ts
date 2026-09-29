import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.hisabkitaab.app",
  appName: "HisabKitaab",
  webDir: "dist",
  server: {
    url: "https://hisabkitaab--ideathon-projects.us-central1.hosted.app",
    cleartext: false,
    androidScheme: "https"
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false
  }
};

export default config;
