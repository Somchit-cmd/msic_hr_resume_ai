import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/components/auth-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MSIC ResumeScreen AI - Intelligent Resume Screening",
  description: "AI-powered resume screening tool for HR professionals. Upload resumes, compare against job descriptions, and get structured audit reports.",
  keywords: ["resume screening", "HR", "AI recruitment", "candidate analysis", "job matching"],
  authors: [{ name: "MSIC ResumeScreen AI" }],
  icons: {
    icon: "https://i.imgur.com/MsQTtuV.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
