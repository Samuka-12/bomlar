import { Suspense } from 'react';
import { getBanners, getProducts, getQuizQuestions } from '@/lib/catalog';
import { Storefront } from '@/components/storefront';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [products, banners, quizQuestions] = await Promise.all([
    getProducts(),
    getBanners(),
    getQuizQuestions(),
  ]);
  const storefrontProducts = products.map(product => ({
    ...product,
    description: '',
    images: product.images.slice(0, 1),
    imageCount: product.images.length,
    reviews: product.reviews?.slice(0, 1) ?? [],
  }));
  return (
    <Suspense fallback={<main className="wrap" style={{ padding: '40px 0', minHeight: '60vh' }}><p style={{ color: '#888' }}>Carregando catálogo Bom Lar...</p></main>}>
      <Storefront products={storefrontProducts} banners={banners} quizQuestions={quizQuestions} />
    </Suspense>
  );
}
