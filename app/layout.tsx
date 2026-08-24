import type { Metadata } from "next";
import { Inter, Cormorant_Garamond, Geist_Mono } from "next/font/google";
import { fontVariables } from "@/lib/theme/fonts";
import "./globals.css";

/*
  Regroup's own chrome typefaces — Inter for body/UI, Cormorant Garamond for
  headings and editorial statements. The editorial-serif/functional-sans split
  is deliberate: serif carries the emotional/theological weight, sans carries
  the interface. This is separate from `fontVariables`, the registry of fonts a
  *church* may pick for its own site (lib/theme/fonts.ts).
*/
/*
  Named "--font-chrome-sans" rather than "--font-inter": the tenant font
  registry (lib/theme/fonts.ts) already defines its own "--font-inter" for
  churches that pick Inter as their site font, and two next/font instances
  sharing one CSS variable name collide unpredictably.
*/
const inter = Inter({
  variable: "--font-chrome-sans",
  subsets: ["latin"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-chrome-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
      className={`${inter.variable} ${cormorant.variable} ${geistMono.variable} ${fontVariables} h-full antialiased`}
    >
      <body className={`${inter.className} min-h-full flex flex-col`}>
        {children}
      </body>
    </html>
  );
}
