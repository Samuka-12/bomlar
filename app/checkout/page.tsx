import { getProducts } from '@/lib/catalog';
import { CheckoutForm } from '@/components/checkout-form';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const checkoutEnabled = Boolean(
    process.env.SUPABASE_URL
    && process.env.SUPABASE_ANON_KEY
    && process.env.SUPABASE_SERVICE_ROLE_KEY
    && process.env.IRONPAY_API_TOKEN,
  );
  const products = await getProducts();
  const addons = products
    .filter(product => {
      if (product.available === false || product.price < 9 || product.price > 29) return false;
      const chosen = product.variants.find(variant => variant.available !== false);
      if (product.variants.length && !chosen) return false;
      const total = product.price + (chosen?.priceExtra ?? 0);
      return total >= 9 && total <= 29;
    })
    .sort((a, b) => a.price - b.price || a.slug.localeCompare(b.slug, 'en'))
    .slice(0, 3);

  return <main className="section"><div className="wrap">
    <span className="eyebrow">{checkoutEnabled ? 'Finalização segura' : 'Checkout em configuração'}</span>
    <h1 className="page-title" style={{ margin: '8px 0 28px' }}>{checkoutEnabled ? 'Só falta confirmar.' : 'Seu carrinho está guardado.'}</h1>
    <CheckoutForm addons={addons} checkoutEnabled={checkoutEnabled}/>
  </div></main>;
}
