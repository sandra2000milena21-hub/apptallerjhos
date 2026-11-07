import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getSettings } from "@/lib/db";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const shopName = s.shop_name === "Mi Taller" || !s.shop_name ? "Taller Jhos" : s.shop_name;
  return {
    title: { default: shopName, template: `%s · ${shopName}` },
    description: "Recepción, reparación y seguimiento de equipos - Taller Jhos",
    appleWebApp: { capable: true, title: shopName, statusBarStyle: "black-translucent" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#0b1320",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO">
      <body className="min-h-dvh antialiased selection:bg-blue-500/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}
