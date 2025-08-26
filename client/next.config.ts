import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/chat_stream/:q*",
        destination: "http://127.0.0.1:8000/chat_stream/:q*",
      },
    ];
  },
};

export default nextConfig;
