import 'server-only';

import { createClient } from '@supabase/supabase-js';

const IRONPAY_BASE_URL = 'https://api.ironpayapp.com.br/api/public/v1';
const DEFAULT_OFFER_HASH = 'znnxaxwoww';
const DEFAULT_PRODUCT_HASH = 'ya4mvapqsm';

export type IronPayCustomer = {
  name: string;
  email: string;
  phone: string;
  document: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
};

export type IronPayCartLine = {
  title: string;
  unitAmountCents: number;
  quantity: number;
};

export type IronPayPixResult = {
  transactionHash: string;
  status: string;
  amountCents: number;
  copyPaste: string;
  qrImageUrl: string | null;
  expiresAt: string | null;
};

export type IronPayTransactionStatus = {
  transactionHash: string;
  status: string;
  amountCents: number;
  paidAt: string | null;
};

export class IronPayError extends Error {
  constructor(
    message: string,
    readonly kind: 'not_configured' | 'rejected' | 'uncertain' | 'invalid_response',
  ) {
    super(message);
    this.name = 'IronPayError';
  }
}

export function isIronPayConfigured(): boolean {
  return Boolean(
    process.env.IRONPAY_API_TOKEN?.trim()
    && (process.env.IRONPAY_OFFER_HASH?.trim() || DEFAULT_OFFER_HASH)
    && (process.env.IRONPAY_PRODUCT_HASH?.trim() || DEFAULT_PRODUCT_HASH),
  );
}

export function createSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('Supabase server credentials are not configured.');
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function apiToken(): string {
  const token = process.env.IRONPAY_API_TOKEN?.trim();
  if (!token) throw new IronPayError('Pix IronPay não está configurado no servidor.', 'not_configured');
  return token;
}

function apiUrl(path: string): URL {
  const baseUrl = process.env.IRONPAY_BASE_URL?.trim() || IRONPAY_BASE_URL;
  const url = new URL(`${baseUrl}${path}`);
  // A documentação pública da IronPay especifica api_token como query parameter.
  // Esta URL é usada apenas no servidor e nunca deve ser incluída em logs/respostas.
  url.searchParams.set('api_token', apiToken());
  return url;
}

function postbackUrl(): string | undefined {
  const configured = process.env.IRONPAY_POSTBACK_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const base = configured || (vercelHost ? `https://${vercelHost}` : undefined);
  if (!base) return undefined;
  try {
    const url = new URL(base.includes('://') ? base : `https://${base}`);
    if (url.protocol !== 'https:') return undefined;
    url.pathname = '/api/ironpay/webhook';
    const webhookToken = process.env.IRONPAY_WEBHOOK_TOKEN?.trim();
    if (webhookToken) {
      url.searchParams.set('token', webhookToken);
    } else {
      url.search = '';
    }
    url.hash = '';
    return url.toString();
  } catch {
    return undefined;
  }
}

async function callIronPay(url: URL, init: RequestInit): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        ...init.headers,
      },
    });
  } catch {
    throw new IronPayError('Não foi possível confirmar a resposta da IronPay.', 'uncertain');
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new IronPayError('A IronPay retornou uma resposta inválida.', response.ok ? 'invalid_response' : 'uncertain');
  }

  if (!response.ok) {
    const rejected = response.status >= 400 && response.status < 500;
    throw new IronPayError(
      rejected ? 'A IronPay recusou os dados desta cobrança.' : 'A resposta da IronPay ficou inconclusiva.',
      rejected ? 'rejected' : 'uncertain',
    );
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new IronPayError('A IronPay retornou uma resposta inválida.', 'invalid_response');
  }
  const root = body as Record<string, unknown>;
  if (root.success === false) {
    throw new IronPayError('A IronPay não aceitou a cobrança.', 'rejected');
  }
  const data = root.data;
  return data && typeof data === 'object' && !Array.isArray(data)
    ? data as Record<string, unknown>
    : root;
}

function safeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function statusString(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : 'pending';
}

function cents(value: unknown): number | null {
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

export async function createIronPayPix(input: {
  orderId: string;
  amountCents: number;
  customer: IronPayCustomer;
  items: IronPayCartLine[];
}): Promise<IronPayPixResult> {
  const offerHash = process.env.IRONPAY_OFFER_HASH?.trim() || DEFAULT_OFFER_HASH;
  const productHash = process.env.IRONPAY_PRODUCT_HASH?.trim() || DEFAULT_PRODUCT_HASH;
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0 || !input.items.length) {
    throw new IronPayError('O total do pedido não é válido para gerar Pix.', 'rejected');
  }

  const body: Record<string, unknown> = {
    amount: input.amountCents,
    offer_hash: offerHash,
    payment_method: 'pix',
    installments: 1,
    customer: {
      name: input.customer.name,
      email: input.customer.email,
      phone_number: input.customer.phone,
      document: input.customer.document,
      street_name: input.customer.street,
      number: input.customer.number,
      complement: input.customer.complement || undefined,
      neighborhood: input.customer.neighborhood,
      city: input.customer.city,
      state: input.customer.state,
      zip_code: input.customer.zipCode,
    },
    cart: input.items.map(item => ({
      product_hash: productHash,
      title: item.title,
      price: item.unitAmountCents,
      quantity: item.quantity,
      operation_type: 1,
      tangible: true,
    })),
    expire_in_days: 1,
    transaction_origin: 'api',
    tracking: {
      src: 'bomlar',
      utm_source: 'bomlar',
      utm_campaign: input.orderId,
    },
  };
  const callback = postbackUrl();
  if (callback) body.postback_url = callback;

  const response = await callIronPay(apiUrl('/transactions'), {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const pix = response.pix && typeof response.pix === 'object'
    ? response.pix as Record<string, unknown>
    : {};
  const transactionHash = safeString(response.hash) ?? safeString(response.transaction_hash);
  const copyPaste = safeString(pix.pix_qr_code)
    ?? safeString(pix.copy_paste)
    ?? safeString(pix.br_code)
    ?? safeString(response.pix_qr_code);
  const amountCents = cents(response.amount) ?? input.amountCents;

  if (!transactionHash || !copyPaste || amountCents !== input.amountCents) {
    throw new IronPayError('A resposta da IronPay não trouxe os dados Pix esperados para este pedido.', 'invalid_response');
  }

  return {
    transactionHash,
    status: statusString(response.payment_status ?? response.status),
    amountCents,
    copyPaste,
    qrImageUrl: safeString(pix.pix_url) ?? safeString(response.pix_url),
    expiresAt: safeString(response.expires_at) ?? safeString(pix.expires_at),
  };
}

export async function getIronPayTransactionStatus(transactionHash: string): Promise<IronPayTransactionStatus> {
  const hash = encodeURIComponent(transactionHash);
  const response = await callIronPay(apiUrl(`/transactions/${hash}`), { method: 'GET' });
  const returnedHash = safeString(response.hash) ?? transactionHash;
  const amountCents = cents(response.amount);
  if (!amountCents) throw new IronPayError('A IronPay retornou um valor inválido para a cobrança.', 'invalid_response');
  return {
    transactionHash: returnedHash,
    status: statusString(response.payment_status ?? response.status),
    amountCents,
    paidAt: safeString(response.paid_at),
  };
}

export function mapIronPayOrderStatus(status: string): string {
  switch (status.toLowerCase()) {
    case 'paid':
    case 'approved':
    case 'completed':
      return 'pago';
    case 'canceled':
    case 'cancelled':
      return 'cancelado';
    case 'expired':
      return 'expirado';
    case 'refunded':
      return 'reembolsado';
    case 'failed':
    case 'rejected':
      return 'falhou';
    case 'waiting_payment':
    case 'pending':
    default:
      return 'aguardando_pagamento';
  }
}
