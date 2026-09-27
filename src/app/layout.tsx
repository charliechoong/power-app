import type { Metadata } from "next";
import { StorageProvider } from "@/lib/storage-mode";
import { storageMode } from "@/lib/server/config";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Commonplace", template: "%s · Commonplace" },
  description: "A personal space for your thoughts, books, and everyday life.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <StorageProvider mode={storageMode()}>{children}</StorageProvider>
      </body>
    </html>
  );
}
