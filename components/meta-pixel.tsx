'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Script from 'next/script';

const DEFAULT_META_PIXEL_ID = '1409699280750716';

type MetaEvent = 'PageView' | 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

export function trackMeta(event: MetaEvent, params?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;

  const { order_id: orderId, ...eventParams } = params ?? {};
  const eventId = event === 'Purchase' && typeof orderId === 'string'
    ? `purchase_${orderId}`
    : globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`;

  window.fbq?.('track', event, eventParams, { eventID: eventId });

  void fetch('/api/meta-event', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    keepalive: true,
    body: JSON.stringify({
      eventName: event,
      eventId,
      orderId: typeof orderId === 'string' ? orderId : undefined,
      parameters: eventParams,
    }),
  }).catch(() => undefined);
}

export function MetaPixel() {
  const pathname = usePathname();
  const [isReady, setIsReady] = useState(false);
  const configuredId = process.env.NEXT_PUBLIC_META_PIXEL_ID || DEFAULT_META_PIXEL_ID;
  const pixelId = configuredId.replace(/[^0-9]/g, '');

  useEffect(() => {
    if (!isReady || !window.fbq) return;
    trackMeta('PageView');
  }, [isReady, pathname]);

  if (!pixelId) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive" onReady={() => setIsReady(true)}>
        {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');`}
      </Script>
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
