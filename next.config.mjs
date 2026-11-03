import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.STANDALONE ? { output: "standalone" } : {}),
  serverExternalPackages: ["@libsql/client", "libsql", "bwip-js"],
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },
  webpack: (config) => {
    config.resolve.alias["@"] = root;
    return config;
  },
};

export default nextConfig;
