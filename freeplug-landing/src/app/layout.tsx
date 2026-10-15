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
  title: { default: "Free Website Outreach | Freeplug", template: "%s" },
  description: "Freeplug finds local business owners who need a website. 72 After builds the free site. We serve San Marcos, Kyle, New Braunfels, San Antonio, and Austin.",
  openGraph: {
    title: "Free Websites for Local Businesses | Freeplug",
    description: "Local business without a website? Request one. 72 After builds it for free.",
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
      <body className="min-h-screen" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
