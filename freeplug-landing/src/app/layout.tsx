import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Freeplug.dev | Free Websites for Local Businesses",
  description: "Get your professional website built for free. We help local businesses establish their online presence with no upfront costs. Only pay for hosting and maintenance.",
  keywords: ["free website", "local business", "web development", "freeplug", "small business website"],
  openGraph: {
    title: "Freeplug.dev | Free Websites for Local Businesses",
    description: "Get your professional website built for free. Only pay for hosting and maintenance.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
