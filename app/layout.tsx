import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Atlas",
    template: "%s · Atlas",
  },
  description: "Tu organización personal: tareas, universidad y más, en un solo sitio.",
  applicationName: "Atlas",
  // iPhone: opened from the home screen it runs full screen, status bar over the dark background.
  appleWebApp: { capable: true, title: "Atlas", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#161826",
  colorScheme: "dark",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
