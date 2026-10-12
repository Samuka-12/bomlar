import { CheckoutForm } from '@/components/checkout-form';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string }>;
}) {
  const { payment } = (await searchParams) || {};
  const initialPayment = payment === 'pix' ? 'pix' : 'credit_card';
  const checkoutEnabled = Boolean(
    process.env.SUPABASE_URL
    && process.env.SUPABASE_ANON_KEY
    && process.env.SUPABASE_SERVICE_ROLE_KEY
    && process.env.IRONPAY_API_TOKEN,
  );

  return <main className="section"><div className="wrap">
    <span className="eyebrow">{initialPayment === 'pix' ? 'Finalização segura · Pix' : 'Finalização segura · Cartão de Crédito'}</span>
    <h1 className="page-title" style={{ margin: '8px 0 28px' }}>
      {initialPayment === 'pix' ? 'Pagar com Pix instantâneo' : 'Pagar no Cartão de Crédito'}
    </h1>
    <CheckoutForm checkoutEnabled={checkoutEnabled} initialPayment={initialPayment} />
  </div></main>;
}
