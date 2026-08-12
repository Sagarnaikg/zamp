import type { Metadata } from "next";
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
         * A literal <script> tag, not next/script's "beforeInteractive" —
         * that strategy queues execution through Next's own script-loading
         * runtime (self.__next_s), which only runs once Next's async
         * framework chunks load. The stylesheet is already render-blocking
         * ready by then, so the browser can paint the OS-preferred theme
         * from the CSS media query before the queued script corrects it to
         * the stored one — the flash this whole file exists to prevent.
         * A raw script as body's first child is part of the literal HTML
         * byte stream instead, so it blocks parsing at this exact point,
         * before anything else in body can paint.
         */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
