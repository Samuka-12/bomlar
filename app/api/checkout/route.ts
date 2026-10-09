import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const itemSchema = z.object({
  slug: z.string().min(1).max(150),
  quantity: z.number().int().min(1).max(20),
  variant: z.string().max(120).optional(),
  downsell: z.boolean().optional().default(false),
});
const schema = z.object({
  cliente_nome: z.string().min(2).max(180),
  telefone: z.string().min(8).max(40),
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
  payment: z.enum(['pix', 'card']),
  items: z.array(itemSchema).min(1).max(30),
  downsellAccepted: z.boolean().default(false),
});
const fail = (message: string, status: number) => NextResponse.json({ saved: false, message }, { status });

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Confira os dados do pedido e o CEP.', 400);
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return fail('As variáveis do Supabase ainda não aparecem no runtime; nenhum pedido foi registrado.', 503);

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const input = parsed.data;
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
  if (error || !data || data.length !== slugs.length) return fail('O catálogo Supabase ainda não está pronto; nenhum pedido foi registrado.', 503);
  const products = new Map(data.map(product => [product.slug, product]));
  for (const [slug, quantity] of requestedBySlug) {
    const product = products.get(slug);
    if (!product || product.disponivel === false) return fail('Produto não disponível.', 409);
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
  for (const line of input.items) {
    const product = products.get(line.slug);
    if (!product) return fail('Produto não disponível.', 400);
    let unitCents = Math.round(Number(product.preco) * 100);
    if (line.variant) {
      const { data: variant, error: variantError } = await db.from('produto_variacoes')
        .select('valor,preco_extra,disponivel')
        .eq('produto_id', product.id)
        .eq('valor', line.variant)
        .maybeSingle();
      if (variantError || !variant) return fail('A opção selecionada não está disponível para este produto.', 409);
      if (variant.disponivel === false) return fail('A opção selecionada está esgotada.', 409);
      unitCents += Math.round(Number(variant.preco_extra ?? 0) * 100);
    }

    if (line.downsell) {
      const basePrice = unitCents / 100;
      if (!input.downsellAccepted || line.slug !== eligibleDownsellSlug || basePrice < 9 || basePrice > 29) {
        return fail('A oferta especial não se aplica a este produto.', 400);
      }
      unitCents = Math.round(unitCents * 0.9);
      acceptedDownsell = true;
    }

    totalCents += unitCents * line.quantity;
    orderLines.push({
      produto_id: product.id,
      slug: product.slug,
      titulo: product.titulo,
      quantidade: line.quantity,
      valor_unitario: unitCents / 100,
      variacao: line.variant ?? null,
      oferta_downsell: line.downsell,
    });
  }

  const total = totalCents / 100;
  const { data: order, error: insertError } = await db.from('pedidos').insert({
    cliente_nome: input.cliente_nome,
    email: input.email,
    telefone: input.telefone,
    itens: { produtos: orderLines, endereco: input.endereco, forma_pagamento: input.payment },
    total,
    status: 'aguardando_pagamento',
    downsell_aceito: acceptedDownsell,
  }).select('id').single();
  if (insertError) return fail('Não foi possível registrar o pedido; nenhuma cobrança foi realizada.', 503);
  return NextResponse.json({ saved: true, orderId: order.id, paymentStatus: 'aguardando_pagamento', total });
}
