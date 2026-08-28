import type { Metadata } from "next";
import { Manrope, Cormorant_Garamond, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { fontVariables } from "@/lib/theme/fonts";
import "./globals.css";

/*
  Regroup's chrome typeface is Manrope, and in the product it is the ONLY one:
  every dashboard heading, label, table row and button is set in it, at one of
  five sizes. A dashboard that mixes families reads as several tools stitched
  together, which is precisely what a church administrator should never have to
  parse.

  Cormorant Garamond is still loaded and still exposed as `--font-chrome-serif`
  (the `font-serif` utility resolves to it), but NOTHING in the product uses it
  any more — the landing page, the onboarding wizard and the dashboard are all
  Manrope. It is kept wired up so an editorial surface can opt back in with one
  class, and `@layer base` in globals.css sets every heading to Manrope so
  nothing inherits serif by accident.

  Both are separate from `fontVariables`, the registry of fonts a *church* may
  pick for its own site (lib/theme/fonts.ts).
*/
/*
  Named "--font-chrome-sans" rather than "--font-manrope": the tenant font
  registry (lib/theme/fonts.ts) defines its own variables for churches that
  pick the same face for their site, and two next/font instances sharing one
  CSS variable name collide unpredictably.
*/
const manrope = Manrope({
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
    <ClerkProvider
      signInUrl="/login"
      signUpUrl="/signup"
      // `--brand` from globals.css, hardcoded here to match: app chrome is
      // intentionally single-themed (see the comment above `.dark` there),
      // and Clerk's `appearance.variables` needs a literal color, not a CSS
      // custom property, to compute its own hover/contrast shades from it.
      appearance={{ variables: { colorPrimary: "#1f3d34" } }}
    >
      <html
        lang="en"
        className={`${manrope.variable} ${cormorant.variable} ${geistMono.variable} ${fontVariables} h-full antialiased`}
      >
        <body className={`${manrope.className} min-h-full flex flex-col`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
