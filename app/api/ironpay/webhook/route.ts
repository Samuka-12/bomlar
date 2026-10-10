import { NextResponse } from 'next/server';
import {
  createSupabaseAdmin,
  getIronPayTransactionStatus,
  mapIronPayOrderStatus,
} from '@/lib/ironpay';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const transactionHash = typeof body?.transaction_hash === 'string'
    ? body.transaction_hash.trim()
    : typeof body?.hash === 'string' ? body.hash.trim() : '';
  if (!/^[A-Za-z0-9_-]{3,160}$/.test(transactionHash)) {
    return NextResponse.json({ received: false }, { status: 400 });
  }

  try {
    const db = createSupabaseAdmin();
    const { data: payment, error: lookupError } = await db.from('pagamentos_pix')
      .select('pedido_id,valor_centavos,status')
      .eq('transaction_hash', transactionHash)
      .maybeSingle();
    if (lookupError) return NextResponse.json({ received: false }, { status: 503 });
    if (!payment) return NextResponse.json({ received: true, matched: false }, { status: 202 });

    // O postback público não é tratado como prova. Confirme o estado e o valor consultando IronPay.
    const verified = await getIronPayTransactionStatus(transactionHash);
    if (verified.transactionHash !== transactionHash || verified.amountCents !== Number(payment.valor_centavos)) {
      return NextResponse.json({ received: false }, { status: 409 });
    }

    const status = mapIronPayOrderStatus(verified.status);
    if (payment.status === 'pago' && status !== 'pago') {
      return NextResponse.json({ received: true, unchanged: true });
    }
    const now = new Date().toISOString();
    const { error: paymentError } = await db.from('pagamentos_pix').update({
      status,
      atualizado_em: now,
      pago_em: status === 'pago' ? verified.paidAt ?? now : null,
    }).eq('transaction_hash', transactionHash);
    if (paymentError) return NextResponse.json({ received: false }, { status: 503 });

    const { error: orderError } = await db.from('pedidos').update({ status }).eq('id', payment.pedido_id);
    if (orderError) return NextResponse.json({ received: false }, { status: 503 });
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ received: false }, { status: 503 });
  }
}
