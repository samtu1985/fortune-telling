import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["react-iztro", "iztro-hook"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
