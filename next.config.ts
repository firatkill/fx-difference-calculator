import type { NextConfig } from "next";

// Middleware (oturum kontrolü) statik export ile çalışmaz; Vercel'de
// normal (server) modda barındırılıyoruz. bkz. docs/plan-platform.md
const nextConfig: NextConfig = {
  // Dev modundaki "N" rozeti/portal'ı, tüm sayfayı kaplayan görünmez bir
  // katman oluşturup altındaki tıklamaları engelleyebiliyor; kapatıldı.
  devIndicators: false,
};

export default nextConfig;
