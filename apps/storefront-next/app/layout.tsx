import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Muslim Abaya | Premium Modest Fashion",
    template: "%s | Muslim Abaya"
  },
  description: "Premium modest fashion from Muslim Abaya.",
  metadataBase: new URL("https://muslimabaya.com"),
  alternates: { canonical: "/" },
  robots: { index: true, follow: true }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#171717"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="bn">
      <body>{children}</body>
    </html>
  );
}
