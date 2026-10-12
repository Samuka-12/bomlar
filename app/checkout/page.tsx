import { CheckoutForm } from '@/components/checkout-form';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const checkoutEnabled = Boolean(
    process.env.SUPABASE_URL
    && process.env.SUPABASE_ANON_KEY
    && process.env.SUPABASE_SERVICE_ROLE_KEY
    && process.env.IRONPAY_API_TOKEN,
  );

  return <main className="section"><div className="wrap">
    <span className="eyebrow">{checkoutEnabled ? 'Finalização segura' : 'Checkout em configuração'}</span>
    <h1 className="page-title" style={{ margin: '8px 0 28px' }}>{checkoutEnabled ? 'Só falta confirmar.' : 'Seu carrinho está guardado.'}</h1>
    <CheckoutForm checkoutEnabled={checkoutEnabled}/>
  </div></main>;
}
