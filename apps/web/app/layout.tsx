import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "HisabKitaab - No confusion. Just Hisab.",
    template: "%s | HisabKitaab",
  },
  description:
    "Keep track of money you give, money you receive, and the people behind every transaction. Simple money records and reminders for local shops and families.",
  applicationName: "HisabKitaab",
  openGraph: {
    title: "HisabKitaab",
    description: "No confusion. Just Hisab.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1620" },
  ],
};

/*
 * Runs before first paint. Inside the Android app (Capacitor injects its bridge
 * into <head> ahead of this script; newer builds also tag the user agent) it
 * marks <html> with `native` and skips the marketing page, so the app opens
 * straight into the product like a native app would.
 */
const NATIVE_BOOT = `(function(){try{var w=window,c=w.Capacitor,ua=navigator.userAgent||"";
var n=(c&&c.isNativePlatform&&c.isNativePlatform())||/HisabKitaabApp/.test(ua)||(w.matchMedia&&w.matchMedia("(display-mode: standalone)").matches);
if(!n)return;document.documentElement.classList.add("native");
if(location.pathname==="/"){location.replace("/dashboard");}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={manrope.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NATIVE_BOOT }} />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[80] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:font-semibold"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
