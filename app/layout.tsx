import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '喝了么 · LAGER DAYS',
  description: '一杯一记。你的日本拉格啤酒日记、容量统计与世界对比。',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: '喝了么', statusBarStyle: 'default' },
  icons: { icon: '/app-icon-v2.png', apple: '/apple-touch-icon.png' },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f7f5ee',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
