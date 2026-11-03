import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getSettings } from "@/lib/db";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    title: { default: s.shop_name, template: `%s · ${s.shop_name}` },
    description: "Recepción, reparación y seguimiento de equipos",
    appleWebApp: { capable: true, title: s.shop_name, statusBarStyle: "black-translucent" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b1320",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
