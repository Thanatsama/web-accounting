import type { Metadata, Viewport } from "next";
import { Prompt } from "next/font/google";
import AppRouterStyleCacheProvider from "@/components/providers/AppRouterStyleCacheProvider";
import AppThemeProvider from "@/components/providers/AppThemeProvider";
import "./globals.css";

const prompt = Prompt({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-prompt",
});

export const metadata: Metadata = {
  title: "Web Accounting",
  description: "Apple-inspired accounting dashboard built with Next.js and MUI.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={prompt.variable}>
        <AppRouterStyleCacheProvider options={{ key: "css" }}>
          <AppThemeProvider>{children}</AppThemeProvider>
        </AppRouterStyleCacheProvider>
      </body>
    </html>
  );
}
