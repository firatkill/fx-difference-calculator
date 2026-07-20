import type { NextConfig } from "next";

// Middleware (oturum kontrolü) statik export ile çalışmaz; Vercel'de
// normal (server) modda barındırılıyoruz. bkz. docs/plan-platform.md
const nextConfig: NextConfig = {};

export default nextConfig;
