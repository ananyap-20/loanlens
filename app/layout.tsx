import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegisterSw from "./RegisterSw";

const TITLE = "Arth: know what it means before you sign";
const DESCRIPTION = "A thumbprint proves who signed. Arth checks that the borrower understood.";
// Optional absolute site URL for link previews; when it is not set, url/metadataBase are simply omitted.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || undefined;

export const metadata: Metadata = {
  ...(SITE_URL ? { metadataBase: new URL(SITE_URL) } : {}),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Arth",
    type: "website",
    locale: "hi_IN",
    ...(SITE_URL ? { url: SITE_URL } : {}),
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0F766E", // primary action colour (deep teal-green)
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hi" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <RegisterSw />
        {children}
      </body>
    </html>
  );
}
