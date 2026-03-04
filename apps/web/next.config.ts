import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    reactStrictMode: true,
    turbopack: {
        root: path.resolve(__dirname, "../.."),
    },
    devIndicators: false,
};

export default nextConfig;
