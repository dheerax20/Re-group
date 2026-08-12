import type { Metadata } from "next";
import { Manrope, Geist_Mono } from "next/font/google";
import { fontVariables } from "@/lib/theme/fonts";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
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
      className={`${manrope.variable} ${geistMono.variable} ${fontVariables} h-full antialiased`}
    >
      <body className={`${manrope.className} min-h-full flex flex-col`}>
        {children}
      </body>
    </html>
  );
}
