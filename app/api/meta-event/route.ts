import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdmin } from '@/lib/ironpay';

export const dynamic = 'force-dynamic';

const DEFAULT_META_PIXEL_ID = '1409699280750716';
const GRAPH_API_VERSION = 'v26.0';
const allowedEvents = ['PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'Purchase'] as const;

const eventSchema = z.object({
  eventName: z.enum(allowedEvents),
  eventId: z.string().min(1).max(100),
  orderId: z.string().uuid().optional(),
  parameters: z.record(z.string(), z.unknown()).optional().default({}),
});

type CustomData = Record<string, string | number | string[]>;

function isSameOriginRequest(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;

  try {
    const originHost = new URL(origin).host;
    const requestHost = new URL(request.url).host;
    const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0].trim();
    const hostHeader = request.headers.get('host')?.split(',')[0].trim();
    const allowedHosts = new Set([requestHost, forwardedHost, hostHeader].filter(Boolean));
    return allowedHosts.has(originHost);
  } catch {
    return false;
  }
}

function cookieValue(request: Request, name: string) {
  const prefix = `${name}=`;
  const item = (request.headers.get('cookie') ?? '')
    .split(';')
    .map(value => value.trim())
    .find(value => value.startsWith(prefix));
  if (!item) return undefined;
  const value = item.slice(prefix.length);
  return value.length > 0 && value.length <= 500 ? value : undefined;
}

function customDataFrom(parameters: Record<string, unknown>): CustomData {
  const result: CustomData = {};
  const value = parameters.value;
  const currency = parameters.currency;
  const contentType = parameters.content_type;
  const contentIds = parameters.content_ids;
  const numItems = parameters.num_items;

  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) result.value = value;
  if (typeof currency === 'string' && /^[A-Z]{3}$/.test(currency)) result.currency = currency;
  if (contentType === 'product') result.content_type = 'product';
  if (Array.isArray(contentIds)) {
    const validIds = contentIds.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 150).slice(0, 50);
    if (validIds.length) result.content_ids = validIds;
  }
  if (typeof numItems === 'number' && Number.isInteger(numItems) && numItems >= 0) result.num_items = numItems;

  return result;
}

function emptyResponse() {
  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return new NextResponse(null, { status: 403 });

  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 400 });

  const token = process.env.META_CONVERSIONS_API_TOKEN;
  if (!token) return emptyResponse();

  const configuredId = process.env.NEXT_PUBLIC_META_PIXEL_ID || DEFAULT_META_PIXEL_ID;
  const pixelId = configuredId.replace(/[^0-9]/g, '');
  if (!pixelId) return emptyResponse();

  const { eventName, eventId, orderId, parameters } = parsed.data;
  const customData = customDataFrom(parameters);

  if (eventName === 'Purchase') {
    if (!orderId || eventId !== `purchase_${orderId}`) return new NextResponse(null, { status: 400 });

    try {
      const db = createSupabaseAdmin();
      const { data: order, error } = await db.from('pedidos')
        .select('id,total,status')
        .eq('id', orderId)
        .maybeSingle();
      if (error || !order || order.status !== 'pago') return emptyResponse();

      const authoritativeValue = Number(order.total);
      if (!Number.isFinite(authoritativeValue) || authoritativeValue <= 0) return emptyResponse();
      customData.value = authoritativeValue;
      customData.currency = 'BRL';
    } catch {
      return emptyResponse();
    }
  }

  const originHeader = request.headers.get('origin');
  if (!originHeader) return emptyResponse();
  const origin = new URL(originHeader);
  const refererHeader = request.headers.get('referer');
  let eventSourceUrl = `${origin.origin}/`;
  if (refererHeader) {
    try {
      const referer = new URL(refererHeader);
      if (referer.host === origin.host) eventSourceUrl = `${origin.origin}${referer.pathname}`;
    } catch {
      // Fall back to the site root when the referrer is malformed.
    }
  }

  const userData: Record<string, string> = {};
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || request.headers.get('x-real-ip')?.trim();
  const userAgent = request.headers.get('user-agent')?.slice(0, 500);
  const fbp = cookieValue(request, '_fbp');
  const fbc = cookieValue(request, '_fbc');
  if (ipAddress) userData.client_ip_address = ipAddress;
  if (userAgent) userData.client_user_agent = userAgent;
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;
  if (!Object.keys(userData).length) return emptyResponse();

  const event = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: 'website',
    event_source_url: eventSourceUrl,
    user_data: userData,
    ...(Object.keys(customData).length ? { custom_data: customData } : {}),
  };
  const endpoint = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pixelId}/events`);
  endpoint.searchParams.set('access_token', token);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: [event] }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null) as { error?: { code?: number; type?: string } } | null;
      console.error('Meta Conversions API returned an error', response.status, result?.error?.type, result?.error?.code);
    }
  } catch {
    console.error('Meta Conversions API request failed');
  }

  return emptyResponse();
}
