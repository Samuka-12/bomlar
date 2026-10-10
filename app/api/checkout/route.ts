import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isValidCpfCnpj, digitsOnly } from '@/lib/cpf-cnpj';
import {
  createIronPayPix,
  createSupabaseAdmin,
  IronPayError,
  isIronPayConfigured,
  mapIronPayOrderStatus,
} from '@/lib/ironpay';

export const dynamic = 'force-dynamic';

const itemSchema = z.object({
  slug: z.string().min(1).max(150),
  quantity: z.number().int().min(1).max(20),
  variant: z.string().max(120).optional(),
  downsell: z.boolean().optional().default(false),
});
const schema = z.object({
  checkoutId: z.string().uuid(),
  cliente_nome: z.string().min(2).max(180),
  telefone: z.string().min(8).max(40),
  document: z.string().min(11).max(20).refine(isValidCpfCnpj, 'Informe um CPF ou CNPJ válido.'),
  email: z.string().email().max(250),
  endereco: z.object({
    cep: z.string().regex(/^\d{5}-?\d{3}$/),
    logradouro: z.string().min(1).max(200),
    bairro: z.string().min(1).max(120),
    cidade: z.string().min(1).max(100),
    uf: z.string().length(2),
    numero: z.string().min(1).max(40),
    complemento: z.string().max(120),
  }),
  payment: z.literal('pix'),
  items: z.array(itemSchema).min(1).max(30),
  downsellAccepted: z.boolean().default(false),
});
const fail = (message: string, status: number, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ saved: false, message, ...extra }, { status, headers: { 'Cache-Control': 'no-store, private' } });

function pixResponse(orderId: string, totalCents: number, payment: Record<string, unknown>) {
  return NextResponse.json({
    saved: true,
    orderId,
    paymentStatus: payment.status,
    total: totalCents / 100,
    pix: {
      copyPaste: payment.pix_copia_cola,
      qrImageUrl: payment.pix_qr_url,
      expiresAt: payment.pix_expira_em,
      status: payment.status,
    },
  }, { headers: { 'Cache-Control': 'no-store, private' } });
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('Confira os dados do pedido, CPF/CNPJ e CEP.', 400);
  if (!isIronPayConfigured()) return fail('Pix ainda não está ativado no servidor. Nenhuma cobrança foi criada.', 503);

  let db;
  try {
    db = createSupabaseAdmin();
  } catch {
    return fail('O registro seguro de pedidos ainda não está configurado. Nenhuma cobrança foi criada.', 503);
  }

  const input = parsed.data;
  const { data: previousOrder, error: previousError } = await db.from('pedidos')
    .select('id,total,status,checkout_id')
    .eq('checkout_id', input.checkoutId)
    .maybeSingle();
  if (previousError) return fail('O banco ainda não está pronto para registrar cobranças Pix.', 503);
  if (previousOrder) {
    const { data: previousPayment, error: paymentError } = await db.from('pagamentos_pix')
      .select('status,valor_centavos,pix_copia_cola,pix_qr_url,pix_expira_em')
      .eq('pedido_id', previousOrder.id)
      .maybeSingle();
    if (paymentError) return fail('Não foi possível recuperar o estado da cobrança.', 503);
    if (previousPayment?.pix_copia_cola) {
      return pixResponse(String(previousOrder.id), Number(previousPayment.valor_centavos), previousPayment as Record<string, unknown>);
    }
    if (previousPayment && ['gerando_pix', 'reconciliacao_pendente'].includes(String(previousPayment.status))) {
      return NextResponse.json({
        saved: false,
        pending: true,
        orderId: previousOrder.id,
        message: 'Estamos confirmando a geração do Pix. Aguarde alguns segundos antes de tentar novamente.',
      }, { status: 202, headers: { 'Cache-Control': 'no-store, private' } });
    }
    return fail('Esta tentativa foi recusada. Inicie uma nova tentativa de checkout para gerar outro Pix.', 409, { retryable: true });
  }

  const downsellLines = input.items.filter(line => line.downsell);
  if (downsellLines.length > 1 || downsellLines.some(line => line.quantity !== 1)) {
    return fail('A oferta final permite apenas uma unidade do complemento selecionado.', 400);
  }
  if (downsellLines.length && !input.downsellAccepted) return fail('Confirme a oferta antes de finalizar o pedido.', 400);

  const slugs = [...new Set(input.items.map(line => line.slug))];
  const requestedBySlug = new Map<string, number>();
  for (const line of input.items) requestedBySlug.set(line.slug, (requestedBySlug.get(line.slug) ?? 0) + line.quantity);
  const { data, error } = await db.from('produtos')
    .select('id,slug,titulo,preco,estoque,disponivel,ativo')
    .in('slug', slugs)
    .eq('ativo', true);
  if (error || !data || data.length !== slugs.length) return fail('O catálogo Supabase não está pronto; nenhum Pix foi solicitado.', 503);
  const products = new Map(data.map(product => [product.slug, product]));
  for (const [slug, quantity] of requestedBySlug) {
    const product = products.get(slug);
    if (!product || product.disponivel === false) return fail('Um dos produtos não está disponível.', 409);
    if (typeof product.estoque === 'number' && product.estoque < quantity) return fail('Estoque insuficiente para um dos produtos.', 409);
  }

  let eligibleDownsellSlug: string | null = null;
  if (downsellLines.length) {
    const { data: candidates, error: candidateError } = await db.from('produtos')
      .select('slug,preco,disponivel,variacoes:produto_variacoes(preco_extra,disponivel)')
      .eq('ativo', true)
      .gte('preco', 9)
      .lte('preco', 29)
      .order('preco', { ascending: true })
      .order('slug', { ascending: true });
    if (candidateError || !candidates) return fail('Não foi possível validar o complemento da oferta.', 503);
    const eligible = candidates.find(candidate => {
      if (candidate.disponivel === false) return false;
      const variants = candidate.variacoes ?? [];
      const chosen = variants.find(variant => variant.disponivel !== false);
      if (variants.length && !chosen) return false;
      const amount = Number(candidate.preco) + Number(chosen?.preco_extra ?? 0);
      return amount >= 9 && amount <= 29;
    });
    if (!eligible || eligible.slug !== downsellLines[0].slug) return fail('A oferta não corresponde ao complemento disponível.', 400);
    eligibleDownsellSlug = eligible.slug;
  }

  let totalCents = 0;
  let acceptedDownsell = false;
  const orderLines: Record<string, unknown>[] = [];
  const ironPayItems: { title: string; unitAmountCents: number; quantity: number }[] = [];
  for (const line of input.items) {
    const product = products.get(line.slug);
    if (!product) return fail('Produto não disponível.', 400);
    let unitCents = Math.round(Number(product.preco) * 100);
    let variantName: string | null = null;
    if (line.variant) {
      const { data: variant, error: variantError } = await db.from('produto_variacoes')
        .select('valor,preco_extra,disponivel')
        .eq('produto_id', product.id)
        .eq('valor', line.variant)
        .maybeSingle();
      if (variantError || !variant) return fail('A opção selecionada não está disponível.', 409);
      if (variant.disponivel === false) return fail('A opção selecionada está esgotada.', 409);
      unitCents += Math.round(Number(variant.preco_extra ?? 0) * 100);
      variantName = variant.valor;
    }
    if (line.downsell) {
      if (!input.downsellAccepted || line.slug !== eligibleDownsellSlug || unitCents < 900 || unitCents > 2900) {
        return fail('A oferta especial não se aplica a este produto.', 400);
      }
      unitCents = Math.round(unitCents * 0.9);
      acceptedDownsell = true;
    }
    if (!Number.isSafeInteger(unitCents) || unitCents <= 0) return fail('Um dos produtos não possui preço válido para Pix.', 400);

    totalCents += unitCents * line.quantity;
    orderLines.push({
      produto_id: product.id,
      slug: product.slug,
      titulo: product.titulo,
      quantidade: line.quantity,
      valor_unitario: unitCents / 100,
      valor_unitario_centavos: unitCents,
      variacao: variantName,
      oferta_downsell: line.downsell,
    });
    ironPayItems.push({
      title: variantName ? `${product.titulo} — ${variantName}` : product.titulo,
      unitAmountCents: unitCents,
      quantity: line.quantity,
    });
  }
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) return fail('O total do pedido não é válido para Pix.', 400);

  const { data: order, error: insertError } = await db.from('pedidos').insert({
    checkout_id: input.checkoutId,
    cliente_nome: input.cliente_nome,
    email: input.email,
    telefone: digitsOnly(input.telefone),
    itens: { produtos: orderLines, endereco: input.endereco, forma_pagamento: 'pix' },
    total: totalCents / 100,
    total_centavos: totalCents,
    status: 'gerando_pix',
    downsell_aceito: acceptedDownsell,
  }).select('id').single();
  if (insertError || !order) return fail('Não foi possível registrar o pedido; nenhuma cobrança foi solicitada.', 503);

  const { error: paymentInsertError } = await db.from('pagamentos_pix').insert({
    pedido_id: order.id,
    valor_centavos: totalCents,
    status: 'gerando_pix',
  });
  if (paymentInsertError) {
    await db.from('pedidos').update({ status: 'pix_erro' }).eq('id', order.id);
    return fail('Não foi possível preparar o registro do Pix. Nenhuma cobrança foi solicitada.', 503);
  }

  try {
    const created = await createIronPayPix({
      orderId: String(order.id),
      amountCents: totalCents,
      customer: {
        name: input.cliente_nome,
        email: input.email,
        phone: digitsOnly(input.telefone),
        document: digitsOnly(input.document),
        street: input.endereco.logradouro,
        number: input.endereco.numero,
        complement: input.endereco.complemento,
        neighborhood: input.endereco.bairro,
        city: input.endereco.cidade,
        state: input.endereco.uf.toUpperCase(),
        zipCode: digitsOnly(input.endereco.cep),
      },
      items: ironPayItems,
    });
    // A resposta de criação fornece o Pix; só a consulta autenticada subsequente confirma pagamento.
    const createdStatus = mapIronPayOrderStatus(created.status);
    const status = createdStatus === 'pago' ? 'aguardando_pagamento' : createdStatus;
    const now = new Date().toISOString();
    const { error: paymentUpdateError } = await db.from('pagamentos_pix').update({
      transaction_hash: created.transactionHash,
      valor_centavos: created.amountCents,
      status,
      pix_copia_cola: created.copyPaste,
      pix_qr_url: created.qrImageUrl,
      pix_expira_em: created.expiresAt,
      atualizado_em: now,
      pago_em: status === 'pago' ? now : null,
    }).eq('pedido_id', order.id);
    if (paymentUpdateError) return fail('A cobrança foi solicitada, mas não foi possível salvar os dados Pix. Contate o atendimento antes de tentar pagar.', 503);

    const { error: orderUpdateError } = await db.from('pedidos').update({ status }).eq('id', order.id);
    if (orderUpdateError) return fail('O Pix foi criado, mas o status do pedido não foi salvo. Contate o atendimento.', 503);
    return pixResponse(String(order.id), totalCents, {
      status,
      pix_copia_cola: created.copyPaste,
      pix_qr_url: created.qrImageUrl,
      pix_expira_em: created.expiresAt,
    });
  } catch (error) {
    const uncertain = !(error instanceof IronPayError) || error.kind !== 'rejected';
    const status = uncertain ? 'reconciliacao_pendente' : 'falhou';
    const now = new Date().toISOString();
    await db.from('pagamentos_pix').update({ status, atualizado_em: now }).eq('pedido_id', order.id);
    await db.from('pedidos').update({ status: uncertain ? 'pix_em_verificacao' : 'pix_erro' }).eq('id', order.id);
    if (uncertain) {
      return fail('Não foi possível confirmar o retorno da IronPay. A tentativa ficou em verificação; aguarde antes de tentar gerar outra cobrança.', 503, { pending: true });
    }
    return fail('A IronPay recusou a geração do Pix. Revise os dados e tente com um novo checkout.', 502, { retryable: true });
  }
}
