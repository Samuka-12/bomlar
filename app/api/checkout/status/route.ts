import { NextResponse } from 'next/server';
import {
  createSupabaseAdmin,
  getIronPayTransactionStatus,
  mapIronPayOrderStatus,
} from '@/lib/ironpay';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const terminalStatuses = new Set(['pago', 'cancelado', 'expirado', 'reembolsado', 'falhou']);

export async function GET(request: Request) {
  const orderId = new URL(request.url).searchParams.get('orderId') ?? '';
  if (!UUID.test(orderId)) return NextResponse.json({ message: 'Pedido inválido.' }, { status: 400 });

  try {
    const db = createSupabaseAdmin();
    const { data: payment, error } = await db.from('pagamentos_pix')
      .select('pedido_id,transaction_hash,valor_centavos,status,pix_copia_cola,pix_qr_url,pix_expira_em,pago_em')
      .eq('pedido_id', orderId)
      .maybeSingle();
    if (error || !payment) return NextResponse.json({ message: 'Cobrança Pix não encontrada.' }, { status: 404 });

    let status = payment.status as string;
    let paidAt = payment.pago_em as string | null;
    if (payment.transaction_hash && !terminalStatuses.has(status)) {
      try {
        const remote = await getIronPayTransactionStatus(payment.transaction_hash as string);
        if (remote.transactionHash === payment.transaction_hash && remote.amountCents === Number(payment.valor_centavos)) {
          status = mapIronPayOrderStatus(remote.status);
          paidAt = remote.paidAt ?? (status === 'pago' ? new Date().toISOString() : paidAt);
          await db.from('pagamentos_pix').update({
            status,
            atualizado_em: new Date().toISOString(),
            pago_em: status === 'pago' ? paidAt : null,
          }).eq('pedido_id', orderId);
          await db.from('pedidos').update({ status }).eq('id', orderId);
        }
      } catch {
        // Keep the last persisted state; the browser can poll again without exposing provider details.
      }
    }

    return NextResponse.json({
      orderId,
      status,
      amountCents: Number(payment.valor_centavos),
      copyPaste: payment.pix_copia_cola,
      qrImageUrl: payment.pix_qr_url,
      expiresAt: payment.pix_expira_em,
      paidAt,
    }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch {
    return NextResponse.json({ message: 'Não foi possível consultar o pagamento agora.' }, { status: 503 });
  }
}
