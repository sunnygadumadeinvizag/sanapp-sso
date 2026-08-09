import type { Metadata } from "next";
import "iipe-common-ui/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "IIPE SSO — Sign in",
  description: "Central authentication for the IIPE Intranet platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
