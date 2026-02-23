console.log("NEXT CONFIG ENV:", process.env.FIREBASE_PROJECT_ID)
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["firebase-admin"]
  }
};

export default nextConfig;
