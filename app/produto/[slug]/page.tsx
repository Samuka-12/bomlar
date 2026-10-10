import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProducts } from '@/lib/catalog';
import { ProductDetail } from '@/components/product-detail';
import { getComplementaryProducts } from '@/lib/recommendations';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const products = await getProducts();
  const product = products.find(p => p.slug === slug);
  if (!product) {
    return { title: 'Produto não encontrado', robots: { index: false, follow: false } };
  }

  const images = product.images.filter(image => /^https?:\/\//i.test(image));
  const desc = product.description.slice(0, 160);

  return {
    title: product.title,
    description: desc,
    openGraph: {
      type: 'website',
      title: `${product.title} | Bom Lar`,
      description: desc,
      ...(images.length ? { images } : {}),
    },
    twitter: {
      card: images.length ? 'summary_large_image' : 'summary',
      ...(images.length ? { images } : {}),
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const products = await getProducts();
  const product = products.find(p => p.slug === slug);
  if (!product) notFound();

  // 1. Recomendações complementares dinâmicas (cross-sell inteligente de 1 ou 2 produtos)
  const complementary = getComplementaryProducts(product, products, 2);

  // 2. Produtos relacionados ("Você também pode gostar")
  const compIds = new Set(complementary.map(c => c.id));
  const related = products
    .filter(p => p.id !== product.id && !compIds.has(p.id) && (p.category === product.category || p.tags.some(tag => product.tags.includes(tag))))
    .slice(0, 4)
    .map(p => ({
      ...p,
      description: '',
      images: p.images.slice(0, 1),
      imageCount: p.images.length,
      reviews: [],
    }));

  return (
    <ProductDetail
      product={product}
      related={related}
      complementary={complementary}
    />
  );
}
