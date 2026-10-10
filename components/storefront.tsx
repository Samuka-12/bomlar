'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Check,
  Plus,
  Search,
  ShieldCheck,
  Truck,
  RefreshCw,
  X,
} from 'lucide-react';
import type { Product, QuizQuestion, StoreBanner } from '@/lib/types';
import { formatBRL } from '@/lib/format';
import { useCart } from '@/components/cart';
import { trackMeta } from '@/components/meta-pixel';

const DEFAULT_QUESTIONS: QuizQuestion[] = [
  {
    text: 'Qual cômodo você quer organizar?',
    options: [
      { text: 'Cozinha', points: { cozinha: 8 } },
      { text: 'Quarto', points: { quarto: 8 } },
      { text: 'Banheiro', points: { banheiro: 8 } },
      { text: 'Lavanderia', points: { lavanderia: 8 } },
      { text: 'Sala', points: { sala: 8 } },
      { text: 'Área externa', points: { externa: 8 } },
    ],
  },
  {
    text: 'Qual é o maior incômodo hoje?',
    options: [
      { text: 'Falta de espaço', points: { 'espaco-pequeno': 3 } },
      { text: 'Bagunça visível', points: { organizacao: 2 } },
      { text: 'Difícil de achar as coisas', points: { gaveta: 2 } },
      { text: 'Sujeira acumulada', points: { pratico: 2 } },
    ],
  },
  {
    text: 'Quanto espaço você tem?',
    options: [
      { text: 'Pouco', points: { 'espaco-pequeno': 3 } },
      { text: 'Médio', points: { compacto: 2 } },
      { text: 'Bastante', points: { grande: 1 } },
    ],
  },
  {
    text: 'Quem mora com você?',
    options: [
      { text: 'Moro sozinho(a)', points: { compacto: 1 } },
      { text: 'Casal', points: { rotina: 1 } },
      { text: 'Família com crianças', points: { familia: 2 } },
    ],
  },
  {
    text: 'Quanto quer investir?',
    options: [
      { text: 'Até R$ 50', points: { 'orcamento-max': 50 } },
      { text: 'Até R$ 100', points: { 'orcamento-max': 100 } },
      { text: 'Sem limite', points: { 'orcamento-max': 99999 } },
    ],
  },
];

function safeHref(value: string | null): string {
  if (!value) return '#produtos';
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : '#produtos';
  } catch {
    return '#produtos';
  }
}

export function ProductCard({ product }: { product: Product }) {
  const { add, setOpen } = useCart();
  const photoCount = product.imageCount ?? product.images.length;
  const discount =
    product.compareAt && product.compareAt > product.price
      ? Math.round((1 - product.price / product.compareAt) * 100)
      : 0;

  return (
    <article className="product-card">
      <Link
        href={`/produto/${product.slug}`}
        className="product-img"
        aria-label={`Ver ${product.title}`}
      >
        {product.images[0] ? (
          <img src={product.images[0]} alt={product.title} loading="lazy" />
        ) : (
          <span className="product-image-empty">Foto indisponível</span>
        )}
        <span className="badge">{discount ? `${discount}% OFF` : 'Achadinho'}</span>
        {photoCount > 1 && <span className="photo-count">{photoCount} fotos</span>}
      </Link>
      <div className="product-info">
        <span className="product-category">{product.category}</span>
        <Link
          href={`/produto/${product.slug}`}
          className="product-title"
          title={product.title}
        >
          {product.title}
        </Link>
        <div className="product-price-row">
          <strong className="product-price">{formatBRL(product.price)}</strong>
          {product.compareAt && product.compareAt > product.price ? (
            <span className="product-old">{formatBRL(product.compareAt)}</span>
          ) : null}
          {discount ? <span className="product-save">-{discount}%</span> : null}
        </div>
        <div className="product-installments">
          ou até 12x de {formatBRL(product.price / 12)}
        </div>
        <button
          className="card-add"
          disabled={product.available === false || product.stock === 0}
          onClick={() => {
            trackMeta('AddToCart', {
              content_type: 'product',
              content_ids: [product.id],
              value: product.price,
              currency: 'BRL',
            });
            add(product);
            setOpen(true);
          }}
        >
          <Plus size={14} />{' '}
          {product.available === false || product.stock === 0
            ? 'Indisponível'
            : 'Adicionar à sacola'}
        </button>
      </div>
    </article>
  );
}

export function Storefront({
  products,
  banners = [],
  quizQuestions = [],
}: {
  products: Product[];
  banners?: StoreBanner[];
  quizQuestions?: QuizQuestion[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get('busca') ?? '';
  const urlCategory = searchParams.get('categoria') ?? '';

  const { add, setOpen } = useCart();
  const questions = quizQuestions.length === 5 ? quizQuestions : DEFAULT_QUESTIONS;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [phone, setPhone] = useState('');
  const [match, setMatch] = useState<Product | null>(null);
  const [alternatives, setAlternatives] = useState<Product[]>([]);

  // Estado de busca e filtros
  const [search, setSearch] = useState(urlSearch);
  const [category, setCategory] = useState(urlCategory || 'Todos');
  const [visibleCount, setVisibleCount] = useState(24);

  const [saved, setSaved] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');

  // Sincroniza com parâmetros de URL
  useEffect(() => {
    setSearch(urlSearch);
  }, [urlSearch]);

  useEffect(() => {
    if (urlCategory) {
      setCategory(urlCategory);
    }
  }, [urlCategory]);

  useEffect(() => {
    setVisibleCount(24);
  }, [category, search]);

  const categories = useMemo(
    () => ['Todos', ...new Set(products.map(p => p.category))],
    [products]
  );

  const isSearching = Boolean(search.trim());

  const handleClearSearch = () => {
    setSearch('');
    setCategory('Todos');
    router.push('/');
  };

  const handleRefineSearch = (term: string) => {
    setSearch(term);
    if (term.trim()) {
      router.push(`/?busca=${encodeURIComponent(term.trim())}`);
    } else {
      router.push('/');
    }
  };

  const next = async () => {
    if (step < questions.length) {
      const list = [...answers, selected];
      setAnswers(list);
      setSelected('');
      setStep(step + 1);
      return;
    }
    const pointSets = answers.map(
      (answer, i) => questions[i]?.options.find(o => o.text === answer)?.points ?? {}
    );
    const budget = Number(pointSets[4]?.['orcamento-max'] ?? 99999);
    const roomTags = Object.keys(pointSets[0] ?? {}).filter(key => key !== 'orcamento-max');
    const roomMatches = products.filter(p =>
      roomTags.some(tag => p.tags.includes(tag) || p.category.toLowerCase().includes(tag))
    );
    const eligible = products.filter(p => p.price <= budget);
    const pool = roomMatches.filter(p => p.price <= budget).length
      ? roomMatches.filter(p => p.price <= budget)
      : eligible.length
        ? eligible
        : roomMatches.length
          ? roomMatches
          : products;
    const ranked = pool
      .map(p => {
        let score = 0;
        for (const points of pointSets.slice(1, 4))
          for (const [tag, value] of Object.entries(points))
            if (tag !== 'orcamento-max' && p.tags.includes(tag)) score += Number(value);
        if (roomTags.some(tag => p.tags.includes(tag) || p.category.toLowerCase().includes(tag)))
          score += 8;
        if (p.price <= budget) score += 1;
        return { p, score };
      })
      .sort((a, b) => b.score - a.score);
    const pick = ranked[0]?.p ?? products[0];
    if (!pick) return;
    setMatch(pick);
    setAlternatives(ranked.slice(1, 3).map(x => x.p));
    const payload = {
      sessionId: crypto.randomUUID(),
      answers: questions.map((q, i) => ({ question: q.text, answer: answers[i] })),
      phone: phone.trim(),
      productId: pick.id,
      alternatives: ranked.slice(1, 3).map(x => x.p.id),
    };
    try {
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setSaved(Boolean(data.saved));
      setSaveNotice(data.message ?? '');
    } catch {
      setSaved(false);
      setSaveNotice(
        'Não foi possível confirmar o registro agora; seu match continua disponível nesta tela.'
      );
    }
  };

  // Filtragem
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p => {
      const matchesCategory = category === 'Todos' || p.category === category;
      if (!q) return matchesCategory;
      const matchesQuery =
        p.title.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q));
      return matchesCategory && matchesQuery;
    });
  }, [products, search, category]);

  // Categorias presentes nos resultados da pesquisa
  const searchCategories = useMemo(() => {
    if (!isSearching) return [];
    const q = search.trim().toLowerCase();
    const allMatches = products.filter(
      p =>
        p.title.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
    );
    return ['Todos', ...new Set(allMatches.map(p => p.category))];
  }, [products, isSearching, search]);

  const discounted = useMemo(
    () =>
      products
        .filter(p => p.compareAt && p.compareAt > p.price)
        .sort((a, b) => b.compareAt! / b.price - a.compareAt! / a.price),
    [products]
  );
  const bestSellers = useMemo(
    () => products.filter(p => p.tags.some(tag => tag.toLowerCase() === 'mais-vendido')).slice(0, 4),
    [products]
  );
  const under = useMemo(() => products.filter(p => p.price <= 97), [products]);
  const reviews = useMemo(
    () =>
      products
        .flatMap(p => (p.reviews ?? []).map(review => ({ product: p, review })))
        .filter(x => x.review.body && x.review.rating > 0)
        .slice(0, 4),
    [products]
  );

  // MODO 1: PESQUISA ATIVA (Visualização dedicada e compacta, sem banners e sem seções iniciais)
  if (isSearching) {
    return (
      <main className="search-results-page">
        <div className="wrap">
          <div className="search-results-head">
            <div className="search-results-meta">
              <span className="eyebrow">Busca no catálogo</span>
              <h1 className="search-query-title">
                Resultados para: <span>&ldquo;{search.trim()}&rdquo;</span>
              </h1>
              <p className="search-count-desc">
                {filtered.length === 1
                  ? '1 achadinho encontrado'
                  : `${filtered.length} achadinhos encontrados`}
              </p>
            </div>

            <div className="search-results-actions">
              <form
                className="search-refine-form"
                onSubmit={e => {
                  e.preventDefault();
                  handleRefineSearch(search);
                }}
              >
                <Search size={15} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Refinar termo de busca..."
                  aria-label="Refinar termo de busca"
                />
                {search && (
                  <button
                    type="button"
                    className="btn-clear-input"
                    onClick={() => handleClearSearch()}
                    aria-label="Limpar pesquisa"
                  >
                    <X size={14} />
                  </button>
                )}
              </form>
              <button
                type="button"
                className="btn-clear-search"
                onClick={handleClearSearch}
              >
                <X size={14} /> Limpar pesquisa
              </button>
            </div>
          </div>

          {searchCategories.length > 2 && (
            <div className="search-category-chips">
              {searchCategories.map(c => (
                <button
                  key={c}
                  className={`option ${category === c ? 'selected' : ''}`}
                  style={{ minHeight: 36, padding: '7px 14px', whiteSpace: 'nowrap' }}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {filtered.length > 0 ? (
            <>
              <div className="product-grid">
                {filtered.slice(0, visibleCount).map(p => (
                  <ProductCard product={p} key={p.id} />
                ))}
              </div>
              {visibleCount < filtered.length && (
                <button
                  className="btn-primary product-load-more"
                  onClick={() =>
                    setVisibleCount(current => Math.min(current + 24, filtered.length))
                  }
                >
                  Carregar mais produtos ({filtered.length - visibleCount} restantes)
                </button>
              )}
            </>
          ) : (
            <div className="empty-search-state">
              <div className="empty-icon">
                <Search size={32} />
              </div>
              <h3>Nenhum produto encontrado</h3>
              <p>
                Não encontramos achadinhos correspondentes a{' '}
                <strong>&ldquo;{search.trim()}&rdquo;</strong>.
                Experimente palavras mais genéricas ou veja os itens por ambiente.
              </p>
              <div className="empty-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleClearSearch}
                >
                  Ver todo o catálogo Bom Lar
                </button>
              </div>
              <div className="empty-suggestions">
                <span className="muted" style={{ fontSize: 11 }}>
                  Sugestões de ambientes populares:
                </span>
                <div className="category-suggestion-chips">
                  {categories
                    .filter(c => c !== 'Todos')
                    .slice(0, 6)
                    .map(c => (
                      <button
                        key={c}
                        type="button"
                        className="chip-suggestion"
                        onClick={() => {
                          setSearch('');
                          setCategory(c);
                          router.push('/');
                        }}
                      >
                        {c}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          )}

          <div className="trust-row" style={{ marginTop: 48 }}>
            <Trust
              icon={<Truck size={18} />}
              title="Entrega para todo o Brasil"
              text="Frete grátis em pedidos acima de R$ 99."
            />
            <Trust
              icon={<ShieldCheck size={18} />}
              title="Compra com tranquilidade"
              text="Seus dados protegidos durante a compra."
            />
            <Trust
              icon={<RefreshCw size={18} />}
              title="Suporte de verdade"
              text="Estamos aqui para ajudar com seu pedido."
            />
          </div>
        </div>
      </main>
    );
  }

  // MODO 2: PÁGINA INICIAL COMPLETA (Hero com quiz, banners exclusivos, vitrines e catálogo)
  return (
    <main>
      <section className="wrap hero">
        <div className="hero-kicker">Achadinhos que fazem sentido</div>
        <h1>
          Qual organizador resolve
          <br />
          a bagunça <em>da sua casa?</em>
        </h1>
        <p className="hero-desc">
          Responda rapidinho. A gente encontra o achadinho certo para o seu espaço, sua rotina e seu bolso.
        </p>
        <div className="quiz-layout" style={{ marginTop: 25 }}>
          <div className="quiz-main">
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${Math.min(100, ((step + 1) / (questions.length + 1)) * 100)}%`,
                }}
              />
            </div>
            {!match ? (
              <>
                <div className="quiz-step">
                  {step < questions.length
                    ? `Etapa ${step + 1} de ${questions.length + 1}`
                    : 'Última etapa · opcional'}
                </div>
                <h2 className="quiz-question">
                  {step < questions.length
                    ? questions[step].text
                    : 'Quer receber o resultado no WhatsApp?'}
                </h2>
                {step < questions.length ? (
                  <div className="option-grid">
                    {questions[step].options.map((option, i) => (
                      <button
                        key={`${option.text}-${i}`}
                        className={`option ${selected === option.text ? 'selected' : ''}`}
                        onClick={() => setSelected(option.text)}
                      >
                        {option.text}
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="quiz-phone">
                      <input
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="(11) 99999-9999 (opcional)"
                        inputMode="tel"
                        aria-label="WhatsApp opcional"
                      />
                      <button className="quiz-next" onClick={next}>
                        Ver meu match <ArrowRight size={15} />
                      </button>
                    </div>
                    <p className="muted" style={{ fontSize: 9 }}>
                      Ao informar seu número, você autoriza o envio deste resultado por WhatsApp. Campo opcional.
                    </p>
                  </>
                )}
                {step < questions.length && (
                  <div className="quiz-controls">
                    <button
                      className="quiz-back"
                      disabled={step === 0}
                      onClick={() => {
                        setStep(Math.max(0, step - 1));
                        setSelected(answers[step - 1] || '');
                      }}
                    >
                      Voltar
                    </button>
                    <button className="quiz-next" disabled={!selected} onClick={next}>
                      Continuar <ArrowRight size={15} />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="quiz-step">Seu match perfeito</div>
                <div className="quiz-result">
                  {match.images[0] ? (
                    <img src={match.images[0]} alt={match.title} />
                  ) : (
                    <span className="product-image-empty">Foto indisponível</span>
                  )}
                  <div>
                    <h3>{match.title}</h3>
                    <p>
                      Selecionado para {answers[0]?.toLowerCase() || 'sua casa'} — prático para a sua rotina.
                    </p>
                    <strong className="product-price">{formatBRL(match.price)}</strong>
                    <div style={{ color: '#8495ba', fontSize: 9, marginTop: 4 }}>
                      {saveNotice ||
                        (saved
                          ? 'Resultado salvo com segurança.'
                          : 'Veja os detalhes do seu achadinho.')}
                    </div>
                  </div>
                  <button
                    className="btn-primary"
                    onClick={() => {
                      trackMeta('AddToCart', {
                        content_type: 'product',
                        content_ids: [match.id],
                        value: match.price,
                        currency: 'BRL',
                      });
                      add(match);
                      setOpen(true);
                    }}
                  >
                    Quero esse
                  </button>
                </div>
                {alternatives.length > 0 && (
                  <div className="quiz-alternatives">
                    <span>Outros matches para sua casa</span>
                    {alternatives.map(item => (
                      <div key={item.id}>
                        <Link href={`/produto/${item.slug}`}>{item.title}</Link>
                        <b>{formatBRL(item.price)}</b>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
                  <button
                    className="quiz-back"
                    onClick={() => {
                      setMatch(null);
                      setStep(0);
                      setAnswers([]);
                      setAlternatives([]);
                      setSaved(false);
                      setSaveNotice('');
                    }}
                  >
                    Refazer quiz
                  </button>
                  <Link href="/#produtos" className="link-blue">
                    Ver todos os produtos →
                  </Link>
                </div>
              </>
            )}
            <a href="#produtos" className="link-blue" style={{ fontSize: 10, marginTop: 17, width: 'max-content' }}>
              Prefiro ver todos os produtos
            </a>
          </div>
          <div className="quiz-side">
            <div className="quiz-side-copy">
              <strong>Pequenas mudanças. Mais espaço para viver.</strong>
              <span>Curadoria prática para cada canto da casa.</span>
            </div>
          </div>
        </div>
      </section>

      {/* Banners exclusivos da página inicial */}
      {banners.length > 0 && (
        <section className="section-tight" aria-label="Ofertas Bom Lar">
          <div className="wrap banner-rail">
            {banners.map(banner => (
              <a
                key={banner.id}
                href={safeHref(banner.link)}
                className="store-banner"
              >
                <span className="eyebrow">Oferta Bom Lar</span>
                {banner.imageUrl && <img src={banner.imageUrl} alt="" loading="lazy" />}
                <strong>{banner.title}</strong>
                {banner.subtitle && <span>{banner.subtitle}</span>}
                <b>
                  Ver oferta <ArrowRight size={14} />
                </b>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Categorias por ambiente */}
      <section className="section-tight" id="categorias">
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow">Encontre por ambiente</span>
              <h2>Comece pelo seu canto</h2>
            </div>
            <p>Organização que acompanha a vida real, da cozinha à lavanderia.</p>
          </div>
          <div className="category-row">
            {categories
              .filter(name => name !== 'Todos')
              .slice(0, 5)
              .map((name, i) => (
                <button
                  key={name}
                  className="category-tile"
                  onClick={() => {
                    setCategory(name);
                    document.getElementById('produtos')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  <span className="category-number">0{i + 1} / BOM LAR</span>
                  <strong>{name}</strong>
                  <span>
                    Ver achadinhos <ArrowRight size={12} />
                  </span>
                </button>
              ))}
          </div>
        </div>
      </section>

      {/* Faixa de Oferta do dia */}
      <section className="offer-band" id="ofertas">
        <div className="wrap offer-inner">
          <div>
            <span className="offer-label">Ofertas do dia · seleção Bom Lar</span>
            <h2>Boas ideias, preço leve.</h2>
            <p>Achadinhos escolhidos para organizar sem complicar.</p>
          </div>
          <OfferTimer />
          <a href="#produtos" className="btn-primary">
            Ver ofertas <ArrowRight size={15} />
          </a>
        </div>
      </section>

      {/* Catálogo de Produtos com filtro e busca inline */}
      <section className="section" id="produtos">
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow">Escolhas para a rotina</span>
              <h2>Achadinhos da casa</h2>
            </div>
            <form
              className="searchbox"
              onSubmit={e => {
                e.preventDefault();
                if (search.trim()) {
                  router.push(`/?busca=${encodeURIComponent(search.trim())}`);
                }
              }}
            >
              <Search size={15} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar achadinho..."
                aria-label="Filtrar produtos"
              />
              {search && (
                <button
                  type="button"
                  className="btn-clear-input"
                  onClick={() => setSearch('')}
                  aria-label="Limpar termo"
                >
                  <X size={14} />
                </button>
              )}
            </form>
          </div>

          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 17 }}>
            {categories.map(c => (
              <button
                key={c}
                className={`option ${category === c ? 'selected' : ''}`}
                style={{ whiteSpace: 'nowrap', minHeight: 35, padding: '7px 13px' }}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>

          {filtered.length ? (
            <>
              <p className="catalog-count">
                Mostrando {Math.min(visibleCount, filtered.length)} de {filtered.length} produtos
              </p>
              <div className="product-grid">
                {filtered.slice(0, visibleCount).map(p => (
                  <ProductCard product={p} key={p.id} />
                ))}
              </div>
              {visibleCount < filtered.length && (
                <button
                  className="btn-primary product-load-more"
                  onClick={() =>
                    setVisibleCount(current => Math.min(current + 24, filtered.length))
                  }
                >
                  Carregar mais produtos
                </button>
              )}
            </>
          ) : (
            <div className="notice">Nenhum produto encontrado nesta busca.</div>
          )}
        </div>
      </section>

      {/* Vitrines da Home */}
      {discounted.length > 0 && (
        <section className="section-tight" style={{ background: '#101010' }}>
          <div className="wrap">
            <div className="section-head">
              <div>
                <span className="eyebrow">Preço especial</span>
                <h2>Mais por menos</h2>
              </div>
              <a href="#produtos" className="link-blue">
                Ver todos →
              </a>
            </div>
            <div className="product-rail">
              {discounted.slice(0, 4).map(p => (
                <ProductCard product={p} key={p.id} />
              ))}
            </div>
          </div>
        </section>
      )}

      {bestSellers.length > 0 && (
        <section className="section-tight" style={{ background: '#101010' }}>
          <div className="wrap">
            <div className="section-head">
              <div>
                <span className="eyebrow">Preferidos da loja</span>
                <h2>Mais vendidos</h2>
              </div>
              <p>Os produtos mais procurados da coleção Bom Lar.</p>
            </div>
            <div className="product-rail">
              {bestSellers.map(p => (
                <ProductCard product={p} key={p.id} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section-tight">
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow">Pequenos favoritos</span>
              <h2>Achadinhos até R$ 97</h2>
            </div>
            <p>Praticidade para experimentar uma rotina mais organizada.</p>
          </div>
          {under.length ? (
            <div className="product-rail">
              {under.slice(0, 4).map(p => (
                <ProductCard product={p} key={p.id} />
              ))}
            </div>
          ) : (
            <p className="muted">Novos achadinhos nessa faixa chegam em breve.</p>
          )}
        </div>
      </section>

      {reviews.length > 0 && (
        <section className="section-tight">
          <div className="wrap">
            <div className="section-head">
              <div>
                <span className="eyebrow">Experiências reais</span>
                <h2>Avaliações verificadas</h2>
              </div>
              <p>Exibimos apenas comentários e notas encontrados na fonte do produto.</p>
            </div>
            <div className="review-rail">
              {reviews.map(({ product, review }, i) => (
                <article className="review-card" key={`${product.id}-${i}`}>
                  <span aria-label={`${review.rating} de 5 estrelas`}>
                    {'★'.repeat(Math.round(review.rating))}
                  </span>
                  <p>&ldquo;{review.body}&rdquo;</p>
                  <b>{review.author || 'Cliente verificado'}</b>
                  <Link href={`/produto/${product.slug}`}>{product.title}</Link>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Confiança */}
      <section className="section-tight">
        <div className="wrap trust-row">
          <Trust
            icon={<Truck size={18} />}
            title="Entrega para todo o Brasil"
            text="Frete grátis em pedidos acima de R$ 99."
          />
          <Trust
            icon={<ShieldCheck size={18} />}
            title="Compra com tranquilidade"
            text="Seus dados protegidos durante a compra."
          />
          <Trust
            icon={<RefreshCw size={18} />}
            title="Suporte de verdade"
            text="Estamos aqui para ajudar com seu pedido."
          />
        </div>
      </section>

      {/* Sobre a Bom Lar */}
      <section className="section-tight" id="sobre">
        <div className="wrap about-copy">
          <span className="eyebrow">Sobre a Bom Lar</span>
          <h2 className="page-title">Casa boa é casa que funciona para você.</h2>
          <p>
            A Bom Lar reúne achadinhos de organização e utilidades domésticas que ajudam a aproveitar melhor cada espaço. Menos complicação no dia a dia, mais espaço para o que importa.
          </p>
          <div className="about-list">
            <div>
              <span className="check-dot">
                <Check size={12} />
              </span>{' '}
              Ideias práticas para a rotina da casa
            </div>
            <div>
              <span className="check-dot">
                <Check size={12} />
              </span>{' '}
              Curadoria com foco em funcionalidade
            </div>
            <div>
              <span className="check-dot">
                <Check size={12} />
              </span>{' '}
              Um bom lar começa com organização
            </div>
          </div>
          <a href="#produtos" className="link-blue">
            Descobrir achadinhos <ArrowRight size={14} />
          </a>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-tight">
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow">Dúvidas rápidas</span>
              <h2>Antes de escolher</h2>
            </div>
          </div>
          <div className="faq-list">
            <details>
              <summary>Como funciona o frete grátis?</summary>
              <p>
                O frete grátis é aplicado a pedidos a partir de R$ 99. Consulte as opções disponíveis para seu CEP no checkout.
              </p>
            </details>
            <details>
              <summary>Como acompanho meu pedido?</summary>
              <p>
                Os detalhes e atualizações do pedido ficam disponíveis após a integração do sistema de atendimento.
              </p>
            </details>
            <details>
              <summary>Quais formas de pagamento estarão disponíveis?</summary>
              <p>
                A loja conta com pagamento via Pix com QR Code dinâmico e aprovação instantânea pela IronPay, e cartão de crédito.
              </p>
            </details>
            <details>
              <summary>Posso receber ajuda para escolher?</summary>
              <p>
                Use o quiz do início da página para encontrar uma recomendação baseada no cômodo, no espaço e no valor que deseja investir.
              </p>
            </details>
          </div>
        </div>
      </section>
    </main>
  );
}

function OfferTimer() {
  const [time, setTime] = useState('24:00:00');
  useEffect(() => {
    const end = Date.now() + Math.max(1, 86400000 - (Date.now() % 86400000));
    const tick = () => {
      const left = Math.max(0, end - Date.now());
      setTime(
        `${String(Math.floor(left / 3600000)).padStart(2, '0')}:${String(
          Math.floor((left % 3600000) / 60000)
        ).padStart(2, '0')}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="timer" aria-label="Contagem regressiva da oferta">
      {time.split(':').map((n, i) => (
        <div className="timer-cell" key={i}>
          <b>{n}</b>
          <span>{['horas', 'min', 'seg'][i]}</span>
        </div>
      ))}
    </div>
  );
}

function Trust({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="trust-card">
      <span className="trust-icon">{icon}</span>
      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
    </div>
  );
}
