import type { Metadata } from "next";
import Script from "next/script";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/layout/app-shell";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

/**
 * Plus Jakarta Sans matches the reference's geometric grotesque — double-storey
 * `a`, tall x-height, tight tracking at display sizes. Mono is kept only for
 * figures that must align in a column.
 */
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Zamp — Document intelligence",
  description:
    "Turn invoices and receipts into structured data you can check, correct, and query.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`}
      // The theme script sets data-theme before React hydrates, so the
      // server markup legitimately differs from the client's.
      suppressHydrationWarning
    >
      <body className="min-h-full font-sans">
        {/*
         * beforeInteractive puts this in the initial HTML ahead of any app
         * code, so the theme is set before first paint. A plain <script> here
         * would work too, but React logs a warning for script tags rendered
         * by components.
         */}
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
