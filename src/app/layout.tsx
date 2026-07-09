/**
 * Root Layout — IIITH Speech Corpus Dataset Collection Platform
 *
 * Responsibilities:
 * - Load Inter (Latin) + Noto Sans Telugu + Noto Sans Devanagari fonts
 *   via next/font/google (bundled, not reliant on system fonts — critical
 *   for correct Telugu/Hindi rendering on all devices/OS)
 * - Apply dark mode class strategy (class on <html>)
 * - Wrap app in QueryClientProvider (React Query)
 * - Mount Sentry error boundary
 */
import type { Metadata } from "next";
import { Inter, Noto_Sans_Telugu, Noto_Sans_Devanagari, Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Providers } from "@/components/providers";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});


// ─── Fonts ────────────────────────────────────────────────────────────────────

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Noto Sans Telugu covers all Telugu Unicode ranges
const notoSansTelugu = Noto_Sans_Telugu({
  subsets: ["telugu"],
  variable: "--font-noto-telugu",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

// Noto Sans Devanagari covers Hindi (and other Devanagari-script languages)
const notoSansDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-noto-devanagari",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

// ─── Metadata ─────────────────────────────────────────────────────────────────

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: {
    default: "IIITH Speech Corpus",
    template: "%s | IIITH Speech Corpus",
  },
  description:
    "Multilingual speech dataset collection platform for IIIT Hyderabad — record English, Telugu, and Hindi sentences for research.",
  keywords: ["speech corpus", "multilingual", "Telugu", "Hindi", "English", "IIIT Hyderabad"],
  authors: [{ name: "IIIT Hyderabad" }],
  robots: {
    index: false, // Internal research tool — not for public indexing
    follow: false,
  },
};

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("dark", inter.variable, notoSansTelugu.variable, notoSansDevanagari.variable, "font-sans", geist.variable, jetbrainsMono.variable)}
    >
      <body className={`${inter.variable} ${notoSansTelugu.variable} ${notoSansDevanagari.variable} ${jetbrainsMono.variable} antialiased selection:bg-accent/30 selection:text-accent font-sans bg-background text-foreground`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
