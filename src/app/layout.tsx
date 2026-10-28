import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Stone Soup",
  description: "Every gift becomes something real: paid straight to the supplier, checked, and delivered.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <header className="border-b border-border">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <Link href="/" className="font-serif text-2xl font-semibold tracking-tight">
              Stone Soup
            </Link>
            <div className="flex gap-5 text-sm text-muted">
              <Link href="/" className="hover:text-foreground">
                Needs
              </Link>
              <Link href="/ngo" className="hover:text-foreground">
                For organisations
              </Link>
              <Link href="/vendor" className="hover:text-foreground">
                For suppliers
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-border py-6 text-center text-xs text-muted">
          Payments run on the PayPal sandbox. No real money moves.
        </footer>
      </body>
    </html>
  );
}
