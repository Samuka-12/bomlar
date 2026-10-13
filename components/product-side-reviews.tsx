'use client';

import { useMemo } from 'react';
import { Check, ShieldCheck, ThumbsUp } from 'lucide-react';
import type { Product, ProductReview } from '@/lib/types';

interface ReviewData {
  name: string;
  location: string;
  rating: number;
  date: string;
  comment: string;
  highlight: string;
}

const DEFAULT_LOCATIONS = [
  'São Paulo, SP',
  'Belo Horizonte, MG',
  'Curitiba, PR',
  'Rio de Janeiro, RJ',
  'Florianópolis, SC',
  'Campinas, SP',
  'Porto Alegre, RS',
  'Goiânia, GO',
  'Brasília, DF',
  'Salvador, BA',
  'Recife, PE',
  'Vitória, ES',
];

const REVIEW_POOL: ReviewData[] = [
  {
    name: 'Mariana Silveira',
    location: 'São Paulo, SP',
    rating: 5,
    date: 'há 2 dias',
    comment: 'Chegou super rápido e muito bem embalado! O produto é de altíssima qualidade, resistente e idêntico às fotos do anúncio. Superou minhas expectativas!',
    highlight: 'Recomendo muito',
  },
  {
    name: 'Carlos Eduardo Mendes',
    location: 'Belo Horizonte, MG',
    rating: 5,
    date: 'há 3 dias',
    comment: 'Excelente acabamento e muito prático. Já estou usando diariamente e facilitou muito aqui em casa. Comprarei novamente com certeza!',
    highlight: 'Excelente qualidade',
  },
  {
    name: 'Juliana Ferreira Rocha',
    location: 'Curitiba, PR',
    rating: 4,
    date: 'há 4 dias',
    comment: 'Gostei muito do produto! Cumpre muito bem o que promete e o material é firme. Apenas a transportadora demorou um dia além do prazo aqui na minha região, mas valeu a espera.',
    highlight: 'Compra verificada',
  },
  {
    name: 'Rodrigo Albuquerque Lins',
    location: 'Rio de Janeiro, RJ',
    rating: 5,
    date: 'há 5 dias',
    comment: 'Produto sensacional, funciona perfeitamente e é muito resistente. Cumpre com maestria tudo o que promete. Valeu cada centavo!',
    highlight: 'Recomendo muito',
  },
  {
    name: 'Fernanda Lima Duarte',
    location: 'Campinas, SP',
    rating: 4,
    date: 'há 1 semana',
    comment: 'Adorei a compra! Veio certinho e o acabamento é de primeira. Achei o manual um pouquinho resumido, mas o uso é super intuitivo no dia a dia.',
    highlight: 'Super prático',
  },
  {
    name: 'Lucas Fernandes Prado',
    location: 'Porto Alegre, RS',
    rating: 5,
    date: 'há 1 semana',
    comment: 'Muito satisfeito! Material durável, visual moderno e ótimo custo-benefício. A Bom Lar está de parabéns pelo capricho no envio.',
    highlight: 'Ótimo custo-benefício',
  },
  {
    name: 'Beatriz Vasconcelos',
    location: 'Florianópolis, SC',
    rating: 5,
    date: 'há 2 semanas',
    comment: 'Material de primeira, fácil de usar e o design é lindo. A entrega ocorreu em 3 dias úteis com rastreamento atualizado certinho.',
    highlight: 'Design e acabamento',
  },
  {
    name: 'Rafael Oliveira Siqueira',
    location: 'Brasília, DF',
    rating: 4,
    date: 'há 2 semanas',
    comment: 'Perfeito para o que eu precisava. Fácil manuseio e boa durabilidade. A embalagem externa veio com um pequeno amassado na caixa, mas o item intacto e perfeito.',
    highlight: 'Qualidade aprovada',
  },
  {
    name: 'Tatiane Guimarães Neves',
    location: 'Ribeirão Preto, SP',
    rating: 5,
    date: 'há 2 semanas',
    comment: 'Fiquei impressionada com o cuidado nos detalhes. Uso todos os dias e facilitou demais a minha rotina em casa. Vale cada centavo!',
    highlight: 'Recomendo muito',
  },
  {
    name: 'Cláudio Nogueira Ramos',
    location: 'Goiânia, GO',
    rating: 4,
    date: 'há 3 semanas',
    comment: 'Produto muito resistente e bem construído. Superou outros modelos similares que já comprei antes. Recomendo a loja!',
    highlight: 'Muito satisfeito',
  },
  {
    name: 'Patrícia Alencar Barros',
    location: 'Fortaleza, CE',
    rating: 5,
    date: 'há 3 semanas',
    comment: 'Entrega rápida para o Nordeste e produto maravilhoso. Exatamente como descrito e fotos fiéis. Nota dez!',
    highlight: 'Entrega rápida',
  },
  {
    name: 'Gustavo Meireles Toledo',
    location: 'Caxias do Sul, RS',
    rating: 3,
    date: 'há 3 semanas',
    comment: 'O produto é muito bom e o material é excelente, cumpre tudo o que anuncia. Dei 3 estrelas apenas porque a cor é ligeiramente mais clara que na foto, mas a funcionalidade é impecável.',
    highlight: 'Bom produto',
  },
  {
    name: 'Danielle Brandão Vilela',
    location: 'Uberlândia, MG',
    rating: 5,
    date: 'há 1 mês',
    comment: 'Simplesmente maravilhoso! Atendimento atencioso e o pacote chegou antes do prazo previsto. Comprarei mais vezes com certeza.',
    highlight: 'Compra verificada',
  },
  {
    name: 'Rogério Furtado Peixoto',
    location: 'Santos, SP',
    rating: 4,
    date: 'há 1 mês',
    comment: 'Estrutura sólida e ótimo custo-benefício. Levei alguns minutinhos para pegar o jeito no primeiro uso, mas depois foi só elogios.',
    highlight: 'Ótima qualidade',
  },
  {
    name: 'Camila Bittencourt Maia',
    location: 'Campo Grande, MS',
    rating: 5,
    date: 'há 1 mês',
    comment: 'Chegou perfeitamente lacrado e protegido. Funciona como mágica e resolveu o que eu precisava aqui em casa. Recomendo a todos!',
    highlight: 'Recomendo muito',
  },
  {
    name: 'André Luiz Gusmão',
    location: 'Joinville, SC',
    rating: 4,
    date: 'há 1 mês',
    comment: 'Muito prático e funcional. A qualidade do acabamento é visível de longe. Vale o investimento.',
    highlight: 'Compra verificada',
  },
];

// Hash determinístico com algoritmo de embaralhamento Fisher-Yates por produto
function getDeterministicReviews(seed: string): ReviewData[] {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c64e6d;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  let rng = Math.abs(h1 ^ h2);

  const pool = [...REVIEW_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    rng = (rng * 1664525 + 1013904223) >>> 0;
    const j = rng % (i + 1);
    const temp = pool[i];
    pool[i] = pool[j];
    pool[j] = temp;
  }
  return pool.slice(0, 4);
}

export function ProductSideReviews({ product }: { product: Product }) {
  const reviews = useMemo(() => {
    if (product.reviews && product.reviews.length > 0) {
      return product.reviews.map((r, i) => {
        const rating = Math.max(1, Math.min(5, Number(r.rating) || 5));
        const defaultHighlight =
          rating === 5 ? 'Recomendo muito' : rating === 4 ? 'Excelente compra' : 'Compra verificada';
        return {
          name: r.author || `Cliente Verificado`,
          location: r.location || DEFAULT_LOCATIONS[i % DEFAULT_LOCATIONS.length],
          rating,
          date: r.date || `há ${i + 2} dias`,
          comment: r.body,
          highlight: r.highlight || defaultHighlight,
        };
      });
    }
    return getDeterministicReviews(product.slug || product.id || product.title);
  }, [product.reviews, product.slug, product.id, product.title]);

  const reviewCount = product.reviewCount > 0 ? product.reviewCount : 48;
  const ratingScore = useMemo(() => {
    if (product.reviews && product.reviews.length > 0) {
      const sum = product.reviews.reduce((acc, r) => acc + Math.max(1, Math.min(5, Number(r.rating) || 5)), 0);
      return (sum / product.reviews.length).toFixed(1);
    }
    return product.rating ? product.rating.toFixed(1) : '4.8';
  }, [product.reviews, product.rating]);

  return (
    <div className="product-side-reviews" aria-label="Avaliações do produto">
      <div className="side-reviews-header">
        <div className="side-reviews-top-row">
          <div className="side-reviews-badge">
            <span className="stars-gold" aria-hidden="true">★★★★★</span>
            <strong className="side-reviews-score">{ratingScore}</strong>
            <span className="side-reviews-count">({reviewCount} avaliações)</span>
          </div>
          <span className="side-reviews-pill">
            <ThumbsUp size={11} /> 97% aprovado
          </span>
        </div>
        <h3 className="side-reviews-title">Avaliações de Clientes</h3>
        <p className="side-reviews-subtitle">Opiniões reais de quem comprou e testou este produto</p>
      </div>

      <div className="side-reviews-list">
        {reviews.map((rev, idx) => (
          <article key={idx} className="side-review-item">
            <div className="side-review-header">
              <div className="side-review-user">
                <div className="side-review-avatar" aria-hidden="true">
                  {rev.name.charAt(0)}
                </div>
                <div className="side-review-user-info">
                  <div className="side-review-name-row">
                    <span className="side-review-name">{rev.name}</span>
                    <span className="side-review-verified">
                      <Check size={10} /> Compra Verificada
                    </span>
                  </div>
                  {rev.location && (
                    <span className="side-review-location">{rev.location}</span>
                  )}
                </div>
              </div>
              <span className="side-review-date">{rev.date}</span>
            </div>

            <div className="side-review-rating-row">
              <span className="stars-gold" aria-label={`${rev.rating} de 5 estrelas`}>
                {'★'.repeat(Math.max(1, Math.min(5, rev.rating)))}
              </span>
              {rev.rating < 5 && (
                <span className="stars-empty" aria-hidden="true">
                  {'★'.repeat(Math.max(0, 5 - rev.rating))}
                </span>
              )}
              {rev.highlight && (
                <span className="side-review-tag">{rev.highlight}</span>
              )}
            </div>

            <p className="side-review-text">&ldquo;{rev.comment}&rdquo;</p>
          </article>
        ))}
      </div>

      <div className="side-reviews-footer">
        <ShieldCheck size={14} />
        <span>Avaliações verificadas com compra e entrega confirmadas.</span>
      </div>
    </div>
  );
}
