/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Compile the shared workspace package from source.
  transpilePackages: ["@moonbite/shared"],
  // Self-contained server bundle for a small Docker runtime image.
  output: "standalone",
};

module.exports = nextConfig;
