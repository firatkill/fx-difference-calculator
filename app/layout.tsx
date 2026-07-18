import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Döviz Kuru Farkı",
  description:
    "e-Fatura zip dosyalarından FIFO mantığıyla döviz kuru farkı hesaplama aracı",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
