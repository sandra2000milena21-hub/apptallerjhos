import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.STANDALONE ? { output: "standalone" } : {}),
  serverExternalPackages: ["@libsql/client", "libsql", "bwip-js"],
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  allowedDevOrigins: [
    "localhost:3000",
    "127.0.0.1:3000",
    "DESKTOP-EHAOJI9.local",
    "DESKTOP-EHAOJI9.local:3000",
    "192.168.20.97",
    "192.168.20.97:3000",
    "172.20.10.3",
    "172.20.10.3:3000",
  ],
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // La cámara y el micrófono solo los usa la propia app (escáner y videos); nada de geolocalización.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=()" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'" },
        ],
      },
      {
        // El panel y las páginas con token del cliente no deben aparecer en buscadores.
        source: "/(panel|s|login|api)/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
  webpack: (config) => {
    config.resolve.alias["@"] = root;
    return config;
  },
};

export default nextConfig;
