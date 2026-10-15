import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist } from "next/font/google";
import "./globals.css";

// Headlines: Bricolage Grotesque (character); everything else: Geist.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Atlas",
    template: "%s · Atlas",
  },
  description: "Tu organización personal: tareas, universidad y más, en un solo sitio.",
  applicationName: "Atlas",
  // iPhone: opened from the home screen it runs full screen with a light status bar area.
  appleWebApp: { capable: true, title: "Atlas", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#f4f4f2",
  colorScheme: "light",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${bricolage.variable} ${geist.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
