import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegisterSw from "./RegisterSw";

export const metadata: Metadata = {
  title: "LoanLens",
  description: "Proof of understanding, alongside the signature.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
