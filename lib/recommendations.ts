import type { Product } from './types';

function extractKeywords(title: string): string[] {
  const stopWords = new Set([
    'de', 'a', 'o', 'e', 'para', 'com', 'em', 'um', 'uma', 'os', 'as', 'do', 'da', 'no', 'na', 'por', 'dos', 'das', 'nos', 'nas'
  ]);
  return title
    .toLowerCase()
    .replace(/[^\w\sáéíóúâêîôûãõç]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
}

// Pares de compatibilidade contextual comum para achadinhos de casa
const COMPLEMENTARY_PAIRS: [string, string][] = [
  ['organizador', 'cesto'],
  ['organizador', 'porta'],
  ['organizador', 'gaveta'],
  ['organizador', 'pote'],
  ['organizador', 'divisoria'],
  ['cesto', 'saco'],
  ['cesto', 'lavanderia'],
  ['cesto', 'prendedor'],
  ['prateleira', 'suporte'],
  ['prateleira', 'organizador'],
  ['ferro', 'vapor'],
  ['ferro', 'roupa'],
  ['ferro', 'tabua'],
  ['tabua', 'ferro'],
  ['cozinha', 'dispenser'],
  ['cozinha', 'escorredor'],
  ['pote', 'hermetico'],
  ['pote', 'tampa'],
  ['garrafa', 'copo'],
  ['faca', 'afiador'],
  ['faca', 'tabua'],
  ['limpeza', 'escova'],
  ['limpeza', 'esponja'],
  ['banheiro', 'suporte'],
  ['banheiro', 'porta'],
  ['porta', 'gancho'],
  ['cabide', 'organizador'],
  ['sapateira', 'organizador'],
];

/**
 * Seleciona 1 a 2 ofertas complementares dinâmicas e inteligentes
 * para o produto informado, utilizando apenas produtos reais do catálogo.
 */
export function getComplementaryProducts(
  current: Product,
  all: Product[],
  limit: number = 2
): Product[] {
  const currentTags = new Set((current.tags || []).map(t => t.toLowerCase()));
  const currentKeywords = new Set(extractKeywords(current.title));
  const currentCategory = (current.category || '').toLowerCase();

  const candidates = all.filter(p => 
    p.id !== current.id && 
    p.slug !== current.slug &&
    p.available !== false && 
    (p.stock === null || p.stock > 0)
  );

  const rooms = ['cozinha', 'banheiro', 'lavanderia', 'quarto', 'sala', 'externa'];

  const scored = candidates.map(candidate => {
    let score = 0;
    const candTags = (candidate.tags || []).map(t => t.toLowerCase());
    const candKeywords = extractKeywords(candidate.title);
    const candCategory = (candidate.category || '').toLowerCase();

    // 1. Alinhamento de ambiente (Cozinha com Cozinha, Lavanderia com Lavanderia, etc.)
    for (const room of rooms) {
      const currentHasRoom = currentTags.has(room) || currentCategory.includes(room);
      const candHasRoom = candTags.includes(room) || candCategory.includes(room);
      if (currentHasRoom && candHasRoom) {
        score += 10;
      }
    }

    // 2. Tags em comum
    for (const tag of candTags) {
      if (currentTags.has(tag)) score += 3;
    }

    // 3. Mesma categoria
    if (candCategory && currentCategory && candCategory === currentCategory) {
      score += 5;
    }

    // 4. Relação contextual complementar (ex: cesto + saco de roupa, faca + tábua)
    for (const [k1, k2] of COMPLEMENTARY_PAIRS) {
      if (
        (currentKeywords.has(k1) && candKeywords.includes(k2)) ||
        (currentKeywords.has(k2) && candKeywords.includes(k1))
      ) {
        score += 8;
      }
    }

    // 5. Palavras-chave compartilhadas no título
    for (const kw of candKeywords) {
      if (currentKeywords.has(kw)) score += 3;
    }

    // 6. Faixa de preço acessível para cross-sell (R$ 15 a R$ 120 ou mais acessível que o produto principal)
    if (candidate.price >= 15 && candidate.price <= 99) {
      score += 4;
    } else if (candidate.price < current.price) {
      score += 2;
    }

    return { product: candidate, score };
  });

  // Ordenar por score decrescente e segundo critério por preço
  scored.sort((a, b) => b.score - a.score || a.product.price - b.product.price);

  // Garantir que as recomendações sejam diversificadas e não repetitivas
  const results: Product[] = [];
  const seenPrefixes = new Set<string>();

  for (const item of scored) {
    if (results.length >= limit) break;
    const prefix = item.product.title.slice(0, 14).toLowerCase();
    if (!seenPrefixes.has(prefix)) {
      seenPrefixes.add(prefix);
      results.push(item.product);
    }
  }

  // Fallback seguro caso não tenha atingido o limite
  if (results.length < limit) {
    for (const item of scored) {
      if (results.length >= limit) break;
      if (!results.some(r => r.id === item.product.id)) {
        results.push(item.product);
      }
    }
  }

  return results;
}
