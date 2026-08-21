import type { Metadata } from "next";
import { Figtree, EB_Garamond, Geist_Mono } from "next/font/google";
import { fontVariables } from "@/lib/theme/fonts";
import "./globals.css";

/*
  Regroup's own chrome typefaces — Figtree for body, EB Garamond for headings,
  eyebrows and nav labels. Both are variable fonts, so no `weight` is pinned:
  the chrome uses 400 through 700 and a fixed subset would silently synthesize
  the rest. This is separate from `fontVariables`, the registry of fonts a
  *church* may pick for its own site (lib/theme/fonts.ts).
*/
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  display: "swap",
});

const ebGaramond = EB_Garamond({
  variable: "--font-eb-garamond",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Regroup — Church Website Builder",
  description:
    "Build a beautiful church website, manage events, members, and courses — all from one platform.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${figtree.variable} ${ebGaramond.variable} ${geistMono.variable} ${fontVariables} h-full antialiased`}
    >
      <body className={`${figtree.className} min-h-full flex flex-col`}>
        {children}
      </body>
    </html>
  );
}
