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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={manrope.variable}>
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
