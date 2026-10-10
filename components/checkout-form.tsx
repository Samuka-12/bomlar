'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Copy, LockKeyhole, MapPin, ShieldCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { Product } from '@/lib/types';
import { formatBRL } from '@/lib/format';
import { useCart } from '@/components/cart';
import { trackMeta } from '@/components/meta-pixel';

const addonUnitPrice = (product: Product) =>
  product.price + (product.variants.find(variant => variant.available !== false)?.priceExtra ?? 0);
const terminalStatuses = new Set(['pago', 'cancelado', 'expirado', 'reembolsado', 'falhou']);

type PixPayment = {
  orderId: string;
  copyPaste: string;
  qrImageUrl: string | null;
  expiresAt: string | null;
  status: string;
  amountCents: number;
  paidAt?: string | null;
};

export function CheckoutForm({ addons, checkoutEnabled = false }: { addons: Product[]; checkoutEnabled?: boolean }) {
  const { lines, total, clear } = useCart();
  const [added, setAdded] = useState<string[]>([]);
  const [payment, setPayment] = useState<'pix'>('pix');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'error' | 'success'>('error');
  const [cep, setCep] = useState('');
  const [document, setDocument] = useState('');
  const [address, setAddress] = useState({ street: '', neighborhood: '', city: '', state: '' });
  const [exitOpen, setExitOpen] = useState(false);
  const [exitChecked, setExitChecked] = useState(false);
  const [exitAccepted, setExitAccepted] = useState(false);
  const [pixPayment, setPixPayment] = useState<PixPayment | null>(null);
  const [copied, setCopied] = useState(false);
  const purchaseTracked = useRef(false);
  const offer = addons[0];
  const addonTotal = useMemo(
    () => addons.filter(addon => added.includes(addon.slug)).reduce(
      (sum, addon) => sum + addonUnitPrice(addon) * (exitAccepted && addon.slug === offer?.slug ? 0.9 : 1),
      0,
    ),
    [addons, added, exitAccepted, offer?.slug],
  );
  const fullTotal = total + addonTotal;

  useEffect(() => {
    if (!checkoutEnabled) return;
    const onExit = (event: MouseEvent) => {
      if (event.clientY <= 0 && lines.length && !sessionStorage.getItem('bomlar-exit-seen')) {
        sessionStorage.setItem('bomlar-exit-seen', '1');
        setExitOpen(true);
      }
    };
    const onPop = () => {
      if (!sessionStorage.getItem('bomlar-back-seen') && lines.length) {
        sessionStorage.setItem('bomlar-back-seen', '1');
        setExitOpen(true);
        history.pushState({ checkout: true }, '', '#checkout');
      }
    };
    history.pushState({ checkout: true }, '', '#checkout');
    const timer = window.setTimeout(() => window.addEventListener('mouseout', onExit), 500);
    window.addEventListener('popstate', onPop);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('mouseout', onExit);
      window.removeEventListener('popstate', onPop);
    };
  }, [lines.length, checkoutEnabled]);

  useEffect(() => {
    const previousOrderId = sessionStorage.getItem('bomlar-pix-order-id');
    if (!previousOrderId) return;
    fetch(`/api/checkout/status?orderId=${encodeURIComponent(previousOrderId)}`, { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (data?.orderId && data.copyPaste) setPixPayment(data as PixPayment);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!pixPayment?.orderId || terminalStatuses.has(pixPayment.status)) return;
    let stopped = false;
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/checkout/status?orderId=${encodeURIComponent(pixPayment.orderId)}`, { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json() as PixPayment;
        if (stopped || data.orderId !== pixPayment.orderId) return;
        setPixPayment(previous => previous?.orderId === data.orderId ? { ...previous, ...data } : previous);
        if (data.status === 'pago' && !purchaseTracked.current) {
          purchaseTracked.current = true;
          trackMeta('Purchase', { value: data.amountCents / 100, currency: 'BRL' });
          clear();
          sessionStorage.removeItem('bomlar-checkout-id');
        }
      } catch {
        // Uma falha transitória de consulta não altera o pagamento; a próxima consulta tenta novamente.
      }
    };
    const timer = window.setInterval(checkStatus, 8000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [pixPayment?.orderId, pixPayment?.status, clear]);

  const lookupCep = async () => {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) return;
    try {
      const response = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await response.json();
      if (data.erro) {
        setMessage('CEP não encontrado. Confira os números.');
        setMessageType('error');
        return;
      }
      setAddress({ street: data.logradouro ?? '', neighborhood: data.bairro ?? '', city: data.localidade ?? '', state: data.uf ?? '' });
      setMessage('Endereço preenchido pelo CEP.');
      setMessageType('success');
    } catch {
      setMessage('Não foi possível consultar o CEP agora. Preencha o endereço manualmente.');
      setMessageType('error');
    }
  };

  async function copyPixCode() {
    if (!pixPayment?.copyPaste) return;
    try {
      await navigator.clipboard.writeText(pixPayment.copyPaste);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setMessage('Não foi possível copiar automaticamente. Selecione e copie o código Pix.');
      setMessageType('error');
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lines.length) {
      setMessage('Sua sacola está vazia. Escolha um produto antes de finalizar.');
      return;
    }
    trackMeta('InitiateCheckout', { value: fullTotal, currency: 'BRL', num_items: lines.reduce((sum, line) => sum + line.quantity, 0) });
    setLoading(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    const items = [
      ...lines.map(line => ({ slug: line.product.slug, quantity: line.quantity, variant: line.variant })),
      ...addons.filter(addon => added.includes(addon.slug)).map(addon => ({
        slug: addon.slug,
        quantity: 1,
        variant: addon.variants.find(variant => variant.available !== false)?.value,
        downsell: exitAccepted && addon.slug === offer?.slug,
      })),
    ];
    const requestPayload = {
      checkoutId: getCheckoutId(),
      cliente_nome: String(form.get('name') || ''),
      telefone: String(form.get('phone') || ''),
      document: document.replace(/\D/g, ''),
      email: String(form.get('email') || ''),
      endereco: {
        cep,
        logradouro: address.street,
        bairro: address.neighborhood,
        cidade: address.city,
        uf: address.state,
        numero: String(form.get('number') || ''),
        complemento: String(form.get('complement') || ''),
      },
      payment,
      items,
      downsellAccepted: exitAccepted,
    };

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });
      const data = await response.json();
      if (!response.ok || !data.saved) {
        setMessage(data.message || 'Não foi possível iniciar o Pix. Nenhuma cobrança foi confirmada.');
        setMessageType('error');
        if (data.retryable) sessionStorage.removeItem('bomlar-checkout-id');
        if (data.pending && data.orderId) {
          sessionStorage.setItem('bomlar-pix-order-id', data.orderId);
          const statusResponse = await fetch(`/api/checkout/status?orderId=${encodeURIComponent(data.orderId)}`, { cache: 'no-store' });
          if (statusResponse.ok) {
            const statusData = await statusResponse.json() as PixPayment;
            if (statusData.copyPaste) setPixPayment(statusData);
          }
        }
        return;
      }

      const created: PixPayment = {
        orderId: data.orderId,
        copyPaste: data.pix.copyPaste,
        qrImageUrl: data.pix.qrImageUrl ?? null,
        expiresAt: data.pix.expiresAt ?? null,
        status: data.pix.status ?? data.paymentStatus ?? 'aguardando_pagamento',
        amountCents: Math.round(Number(data.total) * 100),
      };
      setPixPayment(created);
      sessionStorage.setItem('bomlar-pix-order-id', created.orderId);
      if (created.status === 'pago') {
        purchaseTracked.current = true;
        trackMeta('Purchase', { value: created.amountCents / 100, currency: 'BRL' });
        clear();
        sessionStorage.removeItem('bomlar-checkout-id');
      }
      setMessage('Pix gerado pela IronPay. Escaneie o QR Code ou copie o código abaixo.');
      setMessageType('success');
    } catch {
      setMessage('Não foi possível confirmar a geração do Pix. Aguarde antes de tentar novamente.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  }

  if (pixPayment) {
    const paid = pixPayment.status === 'pago';
    const expired = ['cancelado', 'expirado', 'reembolsado', 'falhou'].includes(pixPayment.status);
    return <section className="panel pix-payment-panel" aria-live="polite">
      <span className="eyebrow">{paid ? 'Pagamento confirmado' : expired ? 'Pix encerrado' : 'Aguardando pagamento'}</span>
      <h2 className="page-title" style={{ fontSize: 25, margin: '8px 0 8px' }}>{paid ? 'Pedido pago.' : expired ? 'Este Pix não está mais ativo.' : 'Pague com Pix'}</h2>
      <p className="muted">Pedido {pixPayment.orderId} · {formatBRL(pixPayment.amountCents / 100)}</p>
      {!paid && !expired && <>
        <div className="pix-qr-wrap">
          <QRCodeSVG value={pixPayment.copyPaste} size={232} level="M" includeMargin bgColor="#ffffff" fgColor="#0A0A0A" aria-label="QR Code de pagamento Pix" />
        </div>
        {pixPayment.expiresAt && <p className="muted" style={{ textAlign: 'center', fontSize: 12 }}>Válido até {new Date(pixPayment.expiresAt).toLocaleString('pt-BR')}</p>}
        <label className="field pix-copy-field"><span>Pix copia e cola</span><textarea readOnly value={pixPayment.copyPaste} rows={4} onFocus={event => event.currentTarget.select()} /></label>
        <button type="button" className="btn-primary pix-copy-button" onClick={copyPixCode}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Código copiado' : 'Copiar código Pix'}</button>
        <p className="muted" style={{ textAlign: 'center', fontSize: 12 }}>Esta tela consulta a IronPay automaticamente a cada 8 segundos para atualizar o pagamento.</p>
      </>}
      {paid && <p className="notice success-notice">Pagamento confirmado pela IronPay. Obrigado pela compra!</p>}
      {expired && <p className="notice error-notice">Não faça o pagamento deste código. Você pode iniciar um novo checkout.</p>}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
        {expired ? <button type="button" className="option" onClick={() => {
          setPixPayment(null);
          sessionStorage.removeItem('bomlar-pix-order-id');
          sessionStorage.removeItem('bomlar-checkout-id');
          purchaseTracked.current = false;
        }}>Gerar um novo Pix</button> : <Link className="option" href="/">Voltar à loja</Link>}
      </div>
    </section>;
  }

  if (!lines.length && messageType !== 'success') return <div className="panel">
    <p className="muted">Sua sacola está vazia. Escolha um achadinho para continuar.</p>
    <Link className="btn-primary" href="/#produtos">Voltar à loja</Link>
  </div>;

  if (!checkoutEnabled) return <div className="panel">
    <span className="eyebrow">Nenhum pedido será enviado</span>
    <h2 className="page-title" style={{ fontSize: 24 }}>O Pix ainda não está ativo.</h2>
    <p className="muted">Seu carrinho permanece salvo neste navegador. Nenhum dado pessoal será solicitado e nenhuma cobrança será criada enquanto o servidor não estiver configurado.</p>
    <div style={{ margin: '20px 0' }}>
      {lines.map(line => <div className="checkout-summary-line" key={`${line.product.id}:${line.variant ?? ''}`}>
        <span>{line.quantity} × {line.product.title}{line.variant ? ` · ${line.variant}` : ''}</span>
        <b>{formatBRL((line.product.price + (line.product.variants.find(variant => variant.value === line.variant)?.priceExtra ?? 0)) * line.quantity)}</b>
      </div>)}
      <div className="checkout-summary-line" style={{ fontWeight: 700 }}><span>Total parcial</span><b>{formatBRL(total)}</b></div>
    </div>
    <Link className="btn-primary" href="/#produtos">Continuar na loja</Link>
  </div>;

  return <div className="checkout-layout">
    <form className="panel" onSubmit={submit}>
      <h2>Seus dados</h2>
      <div className="form-grid">
        <Field label="Nome completo"><input name="name" required autoComplete="name" placeholder="Como podemos chamar você?" /></Field>
        <Field label="WhatsApp"><input name="phone" required autoComplete="tel" inputMode="tel" placeholder="(11) 99999-9999" /></Field>
        <Field label="E-mail"><input name="email" required type="email" autoComplete="email" placeholder="voce@email.com" /></Field>
        <Field label="CPF ou CNPJ"><input value={document} onChange={event => setDocument(formatDocument(event.target.value))} required inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" maxLength={18} aria-label="CPF ou CNPJ" /></Field>
        <Field label="CEP"><div style={{ display: 'flex', gap: 8 }}>
          <input value={cep} onChange={event => setCep(event.target.value)} onBlur={lookupCep} inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" required pattern="[0-9]{5}-?[0-9]{3}" />
          <button type="button" className="icon-button" onClick={lookupCep} aria-label="Buscar CEP"><MapPin size={16} /></button>
        </div></Field>
        <Field label="Endereço" full><input value={address.street} onChange={event => setAddress({ ...address, street: event.target.value })} autoComplete="street-address" required placeholder="Rua ou avenida" /></Field>
        <Field label="Bairro"><input value={address.neighborhood} onChange={event => setAddress({ ...address, neighborhood: event.target.value })} required placeholder="Bairro" /></Field>
        <Field label="Número"><input name="number" required placeholder="Nº" /></Field>
        <Field label="Cidade"><input value={address.city} onChange={event => setAddress({ ...address, city: event.target.value })} required placeholder="Cidade" /></Field>
        <Field label="UF"><input value={address.state} onChange={event => setAddress({ ...address, state: event.target.value })} required maxLength={2} minLength={2} placeholder="SP" /></Field>
        <Field label="Complemento (opcional)" full><input name="complement" placeholder="Apto, bloco, referência" /></Field>
      </div>

      <h2 style={{ marginTop: 27 }}>Forma de pagamento</h2>
      <div className="payment-choice"><label><input type="radio" name="payment" checked={payment === 'pix'} onChange={() => setPayment('pix')} /> Pix</label></div>
      <p className="muted" style={{ fontSize: 11 }}>O QR Code e o Pix copia e cola são gerados pela IronPay com os preços validados no servidor.</p>
      {message && <p className={`notice ${messageType === 'success' ? 'success-notice' : 'error-notice'}`} role="status">{message}</p>}
      <button className="btn-primary checkout-submit" type="submit" disabled={loading}>{loading ? 'Gerando Pix…' : <><LockKeyhole size={15} /> Gerar Pix · {formatBRL(fullTotal)}</>}</button>

      <div className="panel" style={{ marginTop: 13, padding: 16, background: '#101010' }}>
        <h2 style={{ fontSize: 14, marginBottom: 10 }}>Complete sua compra</h2>
        <p className="muted" style={{ fontSize: 10, marginTop: 0 }}>Pequenos complementos para deixar tudo no lugar.</p>
        {addons.length ? addons.map(addon => <label className="addon-row" key={addon.id}>
          <img src={addon.images[0]} alt={addon.title} />
          <span><strong>{addon.title}</strong><span>{formatBRL(addonUnitPrice(addon))}</span></span>
          <input type="checkbox" checked={added.includes(addon.slug)} onChange={event => {
            setAdded(event.target.checked ? [...new Set([...added, addon.slug])] : added.filter(slug => slug !== addon.slug));
            if (addon.slug === offer?.slug && !event.target.checked) { setExitAccepted(false); setExitChecked(false); }
          }} aria-label={`Adicionar ${addon.title}`} />
        </label>) : <p className="muted" style={{ fontSize: 11 }}>Os complementos elegíveis aparecerão aqui quando disponíveis.</p>}
        {addons.length === 1 && <p className="muted" style={{ fontSize: 9 }}>Esta amostra contém um complemento real; novas opções dependem da sincronização do catálogo completo.</p>}
      </div>
      <p style={{ fontSize: 9, color: '#8b8d93', textAlign: 'center' }}><ShieldCheck size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Seus dados são enviados de forma protegida.</p>
    </form>

    <aside><div className="panel">
      <h2>Resumo do pedido</h2>
      {lines.map(line => <div className="checkout-summary-line" key={`${line.product.id}:${line.variant ?? ''}`}>
        <span>{line.quantity} × {line.product.title}</span>
        <b>{formatBRL((line.product.price + (line.product.variants.find(variant => variant.value === line.variant)?.priceExtra ?? 0)) * line.quantity)}</b>
      </div>)}
      {addons.filter(addon => added.includes(addon.slug)).map(addon => <div className="checkout-summary-line" key={addon.id}>
        <span>1 × {addon.title}{exitAccepted && addon.slug === offer?.slug ? ' · 10% off' : ''}</span>
        <b>{formatBRL(addonUnitPrice(addon) * (exitAccepted && addon.slug === offer?.slug ? 0.9 : 1))}</b>
      </div>)}
      <div className="checkout-summary-line"><span>Frete</span><b>{fullTotal >= 99 ? 'Grátis' : 'Calculado pelo CEP'}</b></div>
      <div className="checkout-summary-line" style={{ fontWeight: 700 }}><span>Total</span><b>{formatBRL(fullTotal)}</b></div>
      <p className="muted" style={{ fontSize: 10 }}>Frete grátis em compras a partir de R$ 99.</p>
    </div></aside>

    {exitOpen && <div className="downsell-modal" role="dialog" aria-modal="true" aria-labelledby="downsell-title">
      <div className="downsell-card">
        <span className="eyebrow">Uma última condição</span>
        <h2 id="downsell-title">Leve um complemento com 10% de desconto.</h2>
        <p className="muted" style={{ fontSize: 12 }}>A oferta aparece uma vez nesta sessão e só será adicionada se você marcar a opção.</p>
        {offer ? <label className="addon-row">
          <img src={offer.images[0]} alt={offer.title} />
          <span><strong>{offer.title}</strong><span><del>{formatBRL(addonUnitPrice(offer))}</del> <b>{formatBRL(addonUnitPrice(offer) * 0.9)}</b></span></span>
          <input type="checkbox" checked={exitChecked} onChange={event => setExitChecked(event.target.checked)} aria-label="Aceitar complemento com desconto" />
        </label> : <p className="muted">Nenhum complemento elegível está disponível.</p>}
        <div className="downsell-actions">
          <button className="btn-primary" onClick={() => {
            if (exitChecked && offer) { setAdded([...new Set([...added, offer.slug])]); setExitAccepted(true); }
            setExitOpen(false);
          }}>{exitChecked ? 'Adicionar com 10% off' : 'Continuar sem extra'}</button>
          <button className="option" onClick={() => setExitOpen(false)}>Agora não</button>
        </div>
      </div>
    </div>}
  </div>;
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={`field ${full ? 'full' : ''}`}><label>{label}</label>{children}</div>;
}

function formatDocument(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 11) {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function getCheckoutId(): string {
  const saved = sessionStorage.getItem('bomlar-checkout-id');
  if (saved) return saved;
  const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : createFallbackUuid();
  sessionStorage.setItem('bomlar-checkout-id', id);
  return id;
}

function createFallbackUuid(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
