import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.hisabkitaab.app",
  appName: "HisabKitaab",
  webDir: "dist",
  // Lets the web app recognise the Android shell (see NATIVE_BOOT in apps/web/app/layout.tsx).
  appendUserAgent: "HisabKitaabApp/1.1",
  backgroundColor: "#f5f7f6",
  server: {
    url: "https://hisabkitaab--ideathon-projects.us-central1.hosted.app/dashboard",
    cleartext: false,
    androidScheme: "https"
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false
  },
  plugins: {
    SystemBars: {
      // The site sets viewport-fit=cover; tell the shell up front to avoid a layout jump.
      initialViewportFitValueHint: "cover",
      insetsHandling: "css"
    }
  }
};

export default config;
