import 'server-only';
import { createClient } from '@supabase/supabase-js';
import demo from './demo-catalog.json';
import type { Product, ProductReview, ProductVariant, QuizQuestion, StoreBanner } from './types';

const fallback = demo as Product[];
const PAGE_SIZE = 1000;
const MAX_PRODUCTS = 5000;
const PRODUCT_COLUMNS = 'id,titulo,slug,descricao,preco,preco_de,estoque,disponivel,avaliacao_media,total_avaliacoes,avaliacoes,tags,categoria:categorias(nome),imagens:produto_imagens(url,ordem),variacoes:produto_variacoes(nome,valor,preco_extra,disponivel)';

type DbProduct = {
  id: string | number;
  titulo: string;
  slug: string;
  descricao: string | null;
  preco: number;
  preco_de: number | null;
  estoque: number | null;
  disponivel?: boolean | null;
  avaliacao_media?: number | null;
  total_avaliacoes?: number | null;
  avaliacoes?: ProductReview[] | null;
  tags?: string[] | null;
  categoria?: { nome: string } | null;
  imagens?: { url: string; ordem: number }[];
  variacoes?: { nome: string; valor: string; preco_extra: number; disponivel?: boolean | null }[];
};

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

function toProduct(row: DbProduct): Product {
  return {
    id: String(row.id),
    title: row.titulo,
    slug: row.slug,
    description: row.descricao ?? '',
    price: Number(row.preco),
    compareAt: row.preco_de === null ? null : Number(row.preco_de),
    category: row.categoria?.nome ?? 'Organização',
    tags: row.tags ?? [],
    images: (row.imagens ?? []).sort((a, b) => a.ordem - b.ordem).map(image => image.url),
    stock: row.estoque,
    available: row.disponivel ?? null,
    rating: row.avaliacao_media == null ? null : Number(row.avaliacao_media),
    reviewCount: Number(row.total_avaliacoes ?? 0),
    reviews: row.avaliacoes ?? [],
    variants: (row.variacoes ?? []).map((variant): ProductVariant => ({
      name: variant.nome,
      value: variant.valor,
      priceExtra: Number(variant.preco_extra ?? 0),
      available: variant.disponivel ?? null,
    })),
  };
}

function mergeProduct(remote: Product, local?: Product): Product {
  if (!local) return remote;
  return {
    ...local,
    ...remote,
    images: remote.images.length >= local.images.length ? remote.images : local.images,
  };
}

function mergeWithLocalCatalog(remote: Product[]): Product[] {
  if (!remote.length) return fallback;
  const remoteBySlug = new Map(remote.map(product => [product.slug, product]));
  const localSlugs = new Set(fallback.map(product => product.slug));
  const completeLocalList = fallback.map(local => {
    const databaseProduct = remoteBySlug.get(local.slug);
    return databaseProduct ? mergeProduct(databaseProduct, local) : local;
  });
  const remoteOnly = remote.filter(product => !localSlugs.has(product.slug));
  return [...completeLocalList, ...remoteOnly];
}

export async function getProducts(): Promise<Product[]> {
  const db = client();
  if (!db) return fallback;
  try {
    const rows: DbProduct[] = [];
    for (let start = 0; start < MAX_PRODUCTS; start += PAGE_SIZE) {
      const { data, error } = await db.from('produtos')
        .select(PRODUCT_COLUMNS)
        .eq('ativo', true)
        .order('titulo', { ascending: true })
        .range(start, start + PAGE_SIZE - 1);
      if (error) return fallback;
      const page = (data ?? []) as unknown as DbProduct[];
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
    return mergeWithLocalCatalog(rows.map(toProduct));
  } catch {
    return fallback;
  }
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  const db = client();
  if (!db) return fallback.find(product => product.slug === slug);
  try {
    const { data, error } = await db.from('produtos')
      .select(PRODUCT_COLUMNS)
      .eq('slug', slug)
      .eq('ativo', true)
      .maybeSingle();
    if (error || !data) return fallback.find(product => product.slug === slug);
    const remoteProduct = toProduct(data as unknown as DbProduct);
    const localProduct = fallback.find(product => product.slug === slug);
    return mergeProduct(remoteProduct, localProduct);
  } catch {
    return fallback.find(product => product.slug === slug);
  }
}

export async function getCategories(): Promise<string[]> {
  return [...new Set((await getProducts()).map(product => product.category))];
}

export async function getBanners(): Promise<StoreBanner[]> {
  const db = client();
  if (!db) return [];
  try {
    const { data, error } = await db.from('banners')
      .select('id,titulo,subtitulo,imagem_url,link')
      .eq('ativo', true)
      .order('ordem');
    if (error || !data) return [];
    return data.map((banner: { id: string; titulo: string; subtitulo: string | null; imagem_url: string | null; link: string | null }) => ({
      id: banner.id,
      title: banner.titulo,
      subtitle: banner.subtitulo,
      imageUrl: banner.imagem_url,
      link: banner.link,
    }));
  } catch {
    return [];
  }
}

export async function getQuizQuestions(): Promise<QuizQuestion[]> {
  const db = client();
  if (!db) return [];
  try {
    const { data: questions, error } = await db.from('quiz_perguntas').select('id,texto,ordem').order('ordem');
    if (error || !questions?.length) return [];
    const ids = questions.map(question => question.id);
    const { data: options, error: optionsError } = await db.from('quiz_opcoes')
      .select('pergunta_id,texto,tags_pontos')
      .in('pergunta_id', ids);
    if (optionsError || !options) return [];
    return questions.map(question => ({
      text: question.texto,
      options: options.filter(option => option.pergunta_id === question.id)
        .map(option => ({ text: option.texto, points: (option.tags_pontos ?? {}) as Record<string, number> })),
    }));
  } catch {
    return [];
  }
}
