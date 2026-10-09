import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const schema = z.object({
  sessionId: z.string().uuid(),
  answers: z.array(z.object({ question: z.string().max(200), answer: z.string().max(200) })).max(8),
  phone: z.string().max(40).optional().default(''),
  productId: z.string().max(80).optional(),
  alternatives: z.array(z.string().max(80)).max(3).optional(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ saved: false, message: 'Respostas inválidas.' }, { status: 400 });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ saved: false, message: 'Supabase ainda não conectado.' }, { status: 503 });

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const value = parsed.data;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const { error: answerError } = await db.from('quiz_respostas').insert({
    sessao_id: value.sessionId,
    respostas: { answers: value.answers, alternatives: value.alternatives ?? [] },
    produto_recomendado_id: value.productId && uuid.test(value.productId) ? value.productId : null,
  });
  const answerAlreadySaved = answerError?.code === '23505';
  if (answerError && !answerAlreadySaved) return NextResponse.json({ saved: false, message: 'Não foi possível salvar o resultado no momento.' }, { status: 503 });

  let leadSaved = true;
  if (value.phone.trim()) {
    const { error: leadError } = await db.from('leads').insert({
      sessao_id: value.sessionId,
      nome: null,
      whatsapp: value.phone.trim(),
      origem: 'quiz',
    });
    if (leadError && leadError.code !== '23505') leadSaved = false;
  }

  return NextResponse.json({
    saved: true,
    leadSaved,
    message: leadSaved ? undefined : 'Seu resultado foi salvo, mas o WhatsApp não pôde ser registrado. Você ainda pode consultar seu match.',
  });
}
