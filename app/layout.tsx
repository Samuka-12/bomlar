import type { Metadata, Viewport } from 'next';
import './globals.css';
import { CartProvider, SiteHeader, SiteFooter, CartDrawer } from '@/components/cart';
import { MetaPixel } from '@/components/meta-pixel';

export const metadata: Metadata = {
  title: { default: 'Bom Lar | Achadinhos para casa e organização', template: '%s | Bom Lar' },
  description: 'Achadinhos práticos para organizar cada canto da sua casa. Um bom lar começa com organização.',
  applicationName: 'Bom Lar',
  keywords: ['organização da casa', 'utilidades domésticas', 'organizadores', 'cozinha', 'Bom Lar'],
  openGraph: {
    type: 'website',
    siteName: 'Bom Lar',
    title: 'Bom Lar — Um bom lar começa com organização',
    description: 'Achadinhos práticos para organizar cada canto da sua casa.',
  },
  twitter: { card: 'summary', title: 'Bom Lar — Um bom lar começa com organização', description: 'Achadinhos práticos para organizar cada canto da sua casa.' },
};

export const viewport: Viewport = { themeColor: '#0A0A0A', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <CartProvider>
          <MetaPixel />
          <SiteHeader />
          {children}
          <SiteFooter />
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
