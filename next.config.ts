import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'export',
  distDir: 'dist',
  reactStrictMode: false, 
  transpilePackages: [
    "@electric-sql/pglite",
    "@electric-sql/pglite-react",
  ],
};

export default nextConfig;
