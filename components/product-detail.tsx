'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Minus,
  Plus,
  QrCode,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  Zap,
  ZoomIn,
} from 'lucide-react';
import type { Product } from '@/lib/types';
import { formatBRL } from '@/lib/format';
import { ProductCard } from '@/components/storefront';
import { useCart } from '@/components/cart';
import { trackMeta } from '@/components/meta-pixel';
import { formatDescription } from '@/lib/text-cleaner';

export function ProductDetail({
  product,
  related = [],
  complementary = [],
}: {
  product: Product;
  related?: Product[];
  complementary?: Product[];
}) {
  const router = useRouter();
  const { add, setOpen } = useCart();
  const [image, setImage] = useState(0);
  const [variant, setVariant] = useState(product.variants[0]?.value ?? '');
  const [quantity, setQuantity] = useState(1);
  const [zoom, setZoom] = useState(false);
  const [addedComps, setAddedComps] = useState<string[]>([]);

  const selectedVariant = product.variants.find(v => v.value === variant);
  const unavailable =
    product.available === false ||
    product.stock === 0 ||
    selectedVariant?.available === false;
  const unitPrice = product.price + (selectedVariant?.priceExtra ?? 0);
  const totalPrice = unitPrice * quantity;
  const discount =
    product.compareAt && product.compareAt > unitPrice
      ? Math.round((1 - unitPrice / product.compareAt) * 100)
      : 0;

  // Descrição estruturada profissional sem emojis
  const formattedDesc = useMemo(() => formatDescription(product.description), [product.description]);

  useEffect(() => {
    trackMeta('ViewContent', {
      content_type: 'product',
      content_ids: [product.id],
      value: unitPrice,
      currency: 'BRL',
    });
  }, [product.id, unitPrice]);

  const buy = () => {
    trackMeta('AddToCart', {
      content_type: 'product',
      content_ids: [product.id],
      value: totalPrice,
      currency: 'BRL',
    });
    for (let i = 0; i < quantity; i++) {
      add(product, variant || undefined);
    }
    setOpen(true);
  };

  const buyWithPix = () => {
    trackMeta('AddToCart', {
      content_type: 'product',
      content_ids: [product.id],
      value: totalPrice,
      currency: 'BRL',
    });
    for (let i = 0; i < quantity; i++) {
      add(product, variant || undefined);
    }
    router.push('/checkout');
  };

  const handleAddComplementary = (comp: Product) => {
    add(comp);
    setAddedComps(prev => [...prev, comp.id]);
    setOpen(true);
  };

  return (
    <main className="product-page-main">
      <div className="wrap">
        {/* Breadcrumbs de navegação limpos */}
        <nav className="breadcrumbs" aria-label="Navegação estrutural">
          <Link href="/">Início</Link>
          <ChevronRight size={13} className="crumb-separator" />
          <Link href={`/?categoria=${encodeURIComponent(product.category)}`}>
            {product.category}
          </Link>
          <ChevronRight size={13} className="crumb-separator" />
          <span className="current" aria-current="page">
            {product.title}
          </span>
        </nav>

        <div className="product-detail-grid">
          {/* Coluna 1: Galeria de Imagens */}
          <div className="gallery-col">
            <button
              className="detail-image"
              disabled={!product.images.length}
              onClick={() => setZoom(true)}
              aria-label="Ampliar imagem do produto"
            >
              {product.images[image] ? (
                <img
                  src={product.images[image]}
                  alt={product.title}
                  className="main-product-img"
                />
              ) : (
                <span className="product-image-empty">Foto indisponível</span>
              )}
              {product.images.length > 0 && (
                <span className="image-counter" aria-live="polite">
                  {image + 1} de {product.images.length} fotos
                </span>
              )}
              <span className="zoom-tag">
                <ZoomIn size={14} /> Ampliar
              </span>
            </button>

            {product.images.length > 1 && (
              <div className="detail-thumbs" aria-label="Miniaturas do produto">
                {product.images.map((url, i) => (
                  <button
                    key={`${url}-${i}`}
                    onClick={() => setImage(i)}
                    aria-label={`Visualizar foto ${i + 1}`}
                    aria-current={i === image ? 'true' : undefined}
                    className={`thumb-btn ${i === image ? 'active' : ''}`}
                  >
                    <img src={url} alt={`${product.title} miniatura ${i + 1}`} loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Coluna 2: Informações de Compra e Detalhes */}
          <div className="product-detail-copy">
            <span className="eyebrow">{product.category} · Bom Lar</span>
            <h1 className="product-main-title">{product.title}</h1>

            {product.rating && product.reviewCount > 0 ? (
              <div className="rating-line">
                <span className="stars">★★★★★</span>
                <span>{product.rating.toFixed(1)} · {product.reviewCount} avaliações de clientes</span>
              </div>
            ) : (
              <div className="rating-line">
                <span className="muted">Seleção aprovada para organização residencial</span>
              </div>
            )}

            {/* Preços */}
            <div className="detail-price-box">
              <div className="detail-price">
                {product.compareAt && product.compareAt > unitPrice && (
                  <span className="product-old">{formatBRL(product.compareAt)}</span>
                )}
                <strong>{formatBRL(unitPrice)}</strong>
                {discount > 0 && <span className="product-save">-{discount}%</span>}
              </div>
              <div className="product-installments">
                ou até 12x de {formatBRL(unitPrice / 12)} sem juros no cartão
              </div>
            </div>

            {/* Destaque Pix */}
            <div className="pix-badge-callout">
              <span className="pix-tag">PIX</span>
              <span>
                Pague <strong>{formatBRL(unitPrice)}</strong> no Pix com QR Code dinâmico e aprovação instantânea!
              </span>
            </div>

            {product.stock !== null && product.stock <= 5 && (
              <div className="stock-pill">
                Restam apenas {product.stock} unidades disponíveis no estoque
              </div>
            )}

            {/* Variações */}
            {product.variants.length > 1 && (
              <div className="field variant-selector" style={{ marginTop: 20 }}>
                <label htmlFor="variant-select">Opção do produto</label>
                <select
                  id="variant-select"
                  value={variant}
                  onChange={e => setVariant(e.target.value)}
                >
                  {product.variants.map((v, i) => (
                    <option
                      disabled={v.available === false}
                      key={`${v.value}-${i}`}
                      value={v.value}
                    >
                      {v.value}
                      {v.priceExtra ? ` (+ ${formatBRL(v.priceExtra)})` : ''}
                      {v.available === false ? ' (Esgotado)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Seletor de Quantidade */}
            <div className="quantity-row" style={{ marginTop: 18 }}>
              <label className="qty-label">Quantidade</label>
              <div className="qty-picker">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1 || unavailable}
                  aria-label="Diminuir quantidade"
                >
                  <Minus size={14} />
                </button>
                <span>{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  disabled={unavailable || (product.stock !== null && quantity >= product.stock)}
                  aria-label="Aumentar quantidade"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Botões de Ação Principais */}
            <div className="detail-actions-group">
              <button
                className="btn-pix buy-button"
                disabled={unavailable}
                onClick={buyWithPix}
              >
                <Zap size={18} />
                {unavailable
                  ? 'Produto indisponível'
                  : `Comprar agora no Pix · ${formatBRL(totalPrice)}`}
              </button>

              <button
                className="btn-primary buy-button btn-secondary-action"
                disabled={unavailable}
                onClick={buy}
              >
                <ShoppingBag size={17} />
                {unavailable ? 'Indisponível' : 'Adicionar à sacola'}
              </button>
            </div>

            {/* Benefícios Rápidos */}
            <div className="detail-perks">
              <div>
                <QrCode size={17} style={{ color: '#00bfa5' }} />
                <span>QR Code dinâmico e Pix Copia e Cola gerados na hora</span>
              </div>
              <div>
                <Truck size={17} />
                <span>Frete grátis em pedidos acima de R$ 99</span>
              </div>
              <div>
                <ShieldCheck size={17} />
                <span>Compra protegida com notificação e rastreio</span>
              </div>
            </div>

            {/* Ofertas complementares dinâmicas (Cross-sell inteligente) */}
            {complementary.length > 0 && (
              <section className="complementary-box" aria-label="Ofertas complementares">
                <div className="comp-header">
                  <div className="comp-title-row">
                    <Sparkles size={16} className="comp-icon" />
                    <strong>Aproveite e leve junto</strong>
                  </div>
                  <p className="comp-subtitle">
                    Produtos selecionados que complementam o uso deste achadinho:
                  </p>
                </div>

                <div className="comp-list">
                  {complementary.map(comp => (
                    <article key={comp.id} className="comp-card">
                      <Link href={`/produto/${comp.slug}`} className="comp-card-img">
                        {comp.images[0] ? (
                          <img src={comp.images[0]} alt={comp.title} loading="lazy" />
                        ) : (
                          <span className="product-image-empty">Sem foto</span>
                        )}
                      </Link>

                      <div className="comp-card-body">
                        <span className="comp-card-cat">{comp.category}</span>
                        <Link href={`/produto/${comp.slug}`} className="comp-card-title">
                          {comp.title}
                        </Link>
                        <div className="comp-card-price">
                          <strong>{formatBRL(comp.price)}</strong>
                          {comp.compareAt && comp.compareAt > comp.price && (
                            <span className="comp-card-old">{formatBRL(comp.compareAt)}</span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        className={`btn-comp-add ${addedComps.includes(comp.id) ? 'is-added' : ''}`}
                        onClick={() => handleAddComplementary(comp)}
                        aria-label={`Adicionar ${comp.title} à sacola`}
                      >
                        {addedComps.includes(comp.id) ? (
                          <>
                            <Check size={14} /> Adicionado
                          </>
                        ) : (
                          <>
                            <Plus size={14} /> Adicionar
                          </>
                        )}
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {/* Descrição Limpa, Moderna e Sem Emojis */}
            <div className="product-description-container">
              <details open className="detail-accordion">
                <summary>Sobre este produto</summary>
                <div className="accordion-content">
                  {formattedDesc.intro && (
                    <p className="desc-intro">{formattedDesc.intro}</p>
                  )}

                  {formattedDesc.sections.map((section, idx) => (
                    <div key={idx} className="desc-section-block">
                      {section.title && <h3 className="desc-section-title">{section.title}</h3>}
                      {section.paragraphs.map((p, pIdx) => (
                        <p key={pIdx} className="desc-p">{p}</p>
                      ))}
                      {section.bullets && section.bullets.length > 0 && (
                        <ul className="desc-bullet-list">
                          {section.bullets.map((b, bIdx) => (
                            <li key={bIdx}>{b}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}

                  {!formattedDesc.sections.length && !formattedDesc.intro && (
                    <p className="desc-p">
                      Item selecionado pela curadoria Bom Lar para trazer praticidade, organização e leveza à sua casa.
                    </p>
                  )}
                </div>
              </details>

              <details className="detail-accordion">
                <summary>Entrega e pagamento</summary>
                <div className="accordion-content">
                  <p className="desc-p">
                    <strong>Pagamento:</strong> Pagamento via Pix com liberação imediata gerado pela IronPay, ou parcelado no cartão.
                  </p>
                  <p className="desc-p">
                    <strong>Envio:</strong> Entregas realizadas para todo o Brasil. Informe seu CEP no checkout para verificar o prazo para seu endereço. Pedidos a partir de R$ 99 contam com frete grátis.
                  </p>
                </div>
              </details>
            </div>
          </div>
        </div>

        {/* Avaliações Verificadas */}
        {product.reviews && product.reviews.length > 0 && (
          <section className="section-tight reviews-section">
            <div className="section-head">
              <div>
                <span className="eyebrow">Opiniões de quem comprou</span>
                <h2>Avaliações verificadas</h2>
              </div>
            </div>
            <div className="review-rail">
              {product.reviews.slice(0, 8).map((review, i) => (
                <article className="review-card" key={i}>
                  <span className="stars" aria-label={`${review.rating} de 5 estrelas`}>
                    {'★'.repeat(Math.round(review.rating))}
                  </span>
                  <p>&ldquo;{review.body}&rdquo;</p>
                  <b>{review.author || 'Cliente verificado'}</b>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Produtos Relacionados */}
        {related.length > 0 && (
          <section className="section-tight related-section">
            <div className="section-head">
              <div>
                <span className="eyebrow">Você também pode gostar</span>
                <h2>Outros achadinhos para sua casa</h2>
              </div>
            </div>
            <div className="product-rail">
              {related.map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}

        {/* Modal de Zoom */}
        {zoom && (
          <div
            className="image-zoom"
            role="dialog"
            aria-modal="true"
            onClick={() => setZoom(false)}
          >
            <button
              className="icon-button"
              onClick={() => setZoom(false)}
              aria-label="Fechar imagem ampliada"
            >
              ×
            </button>
            <img src={product.images[image]} alt={product.title} />
          </div>
        )}

        {/* Barra de Compra Rápida Fixa no Rodapé para Celular */}
        <div className="mobile-buybar">
          <div className="mobile-buybar-info">
            <span className="mobile-buybar-title">{product.title}</span>
            <b className="mobile-buybar-price">{formatBRL(unitPrice)} no Pix</b>
          </div>
          <button
            className="btn-pix mobile-buybar-btn"
            disabled={unavailable}
            onClick={buyWithPix}
          >
            {unavailable ? 'Indisponível' : 'Pagar no Pix'}
          </button>
        </div>
      </div>
    </main>
  );
}
