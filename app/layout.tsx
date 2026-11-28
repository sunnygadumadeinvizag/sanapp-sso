import type { Metadata } from "next";
import localFont from "next/font/local";
import "sanapp-common-ui/styles.css";
import "./globals.css";
import { ThemeScript } from "sanapp-common-ui";

const inter = localFont({
  src: "./fonts/Inter.ttf",
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "IIPE Intranet Login",
  description: "Sign in to the IIPE Intranet platform",
};

const SSO_BASE_URL = process.env.SSO_BASE_URL ?? "http://localhost:3000";

async function getTheme() {
  const fallback = { mode: "system", primary: "#004499", accent: "#d9a441" } as const;
  try {
    const res = await fetch(`${SSO_BASE_URL}/api/theme`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    return {
      mode: data.mode ?? fallback.mode,
      primary: data.primary ?? fallback.primary,
      accent: data.accent ?? fallback.accent,
    };
  } catch {
    return fallback;
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await getTheme();
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body>
        <ThemeScript
          defaultMode={theme.mode}
          primary={theme.primary}
          accent={theme.accent}
        />
        {children}
      </body>
    </html>
  );
}
