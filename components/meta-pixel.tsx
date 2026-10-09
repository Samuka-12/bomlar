'use client';
import Script from 'next/script';

type MetaEvent='ViewContent'|'AddToCart'|'InitiateCheckout'|'Purchase';
declare global { interface Window { fbq?: (...args:unknown[])=>void; _fbq?:unknown } }
export function trackMeta(event:MetaEvent,params?:Record<string,unknown>){if(typeof window==='undefined'||!window.fbq)return;window.fbq('track',event,params??{});}
export function MetaPixel(){const id=process.env.NEXT_PUBLIC_META_PIXEL_ID;if(!id)return null;const safeId=id.replace(/[^0-9]/g,'');if(!safeId)return null;return <><Script id="meta-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${safeId}');fbq('track','PageView');`}</Script><noscript><img height="1" width="1" style={{display:'none'}} src={`https://www.facebook.com/tr?id=${safeId}&ev=PageView&noscript=1`} alt=""/></noscript></>;}
