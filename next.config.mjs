/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
