import type { NextConfig } from "next";

/** Where the NestJS API runs (backend/). Locally: `npm run dev` inside backend/ listens on 4000. */
const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // No sniffing, no framing (clickjacking), HTTPS only, and no camera/mic/location for pages here.
  // A Content-Security-Policy is left out on purpose: Next's inline scripts and Yandex Metrica need a nonce setup first.
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
  // The browser keeps calling /api/* on this site; Next hands those requests to the API, so the
  // session cookie stays on this domain and nothing about the web app's URLs changes.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
