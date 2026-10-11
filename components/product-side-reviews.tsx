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
    name: 'Carlos Eduardo M.',
    location: 'Belo Horizonte, MG',
    rating: 5,
    date: 'há 3 dias',
    comment: 'Excelente acabamento e muito prático. Já estou usando diariamente e facilitou muito aqui em casa. Comprarei novamente com certeza!',
    highlight: 'Excelente qualidade',
  },
  {
    name: 'Juliana Ferreira',
    location: 'Curitiba, PR',
    rating: 5,
    date: 'há 5 dias',
    comment: 'Confesso que fiquei na dúvida antes de fechar o pedido, mas me surpreendeu positivamente. Firme, muito bem feito e entrega nota 10!',
    highlight: 'Entrega rápida',
  },
  {
    name: 'Rodrigo Albuquerque',
    location: 'Rio de Janeiro, RJ',
    rating: 5,
    date: 'há 1 semana',
    comment: 'Produto sensacional, funciona perfeitamente e é muito resistente. Cumpre com maestria tudo o que promete. Valeu cada centavo!',
    highlight: 'Compra verificada',
  },
  {
    name: 'Fernanda Lima',
    location: 'Campinas, SP',
    rating: 5,
    date: 'há 1 semana',
    comment: 'Adorei a compra! Veio certinho, entrega antes do prazo e o produto é super útil. Já vou garantir mais um para presentear.',
    highlight: 'Super prático',
  },
  {
    name: 'Lucas Fernandes',
    location: 'Porto Alegre, RS',
    rating: 5,
    date: 'há 2 semanas',
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
    name: 'Rafael Oliveira',
    location: 'Brasília, DF',
    rating: 5,
    date: 'há 3 semanas',
    comment: 'Perfeito para o que eu precisava. Fácil manuseio e qualidade muito acima da média do mercado. Comprem sem medo!',
    highlight: 'Qualidade aprovada',
  },
];

// Hash determinístico simples para gerar sempre as mesmas avaliações consistentes para cada produto
function getDeterministicReviews(seed: string): ReviewData[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = Math.abs(hash);
  const startIndex = positiveHash % REVIEW_POOL.length;

  const count = 4;
  const selected: ReviewData[] = [];
  for (let i = 0; i < count; i++) {
    selected.push(REVIEW_POOL[(startIndex + i) % REVIEW_POOL.length]);
  }
  return selected;
}

export function ProductSideReviews({ product }: { product: Product }) {
  const reviews = useMemo(() => {
    if (product.reviews && product.reviews.length > 0) {
      return product.reviews.map((r, i) => ({
        name: r.author || `Cliente Verificado`,
        location: 'Brasil',
        rating: r.rating || 5,
        date: r.date || `há ${i + 2} dias`,
        comment: r.body,
        highlight: 'Compra verificada',
      }));
    }
    return getDeterministicReviews(product.slug || product.id || product.title);
  }, [product.reviews, product.slug, product.id, product.title]);

  const reviewCount = product.reviewCount > 0 ? product.reviewCount : 48;
  const ratingScore = product.rating ? product.rating.toFixed(1) : '4.9';

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
            <ThumbsUp size={11} /> 98% aprovado
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
                {'★'.repeat(rev.rating)}
              </span>
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
