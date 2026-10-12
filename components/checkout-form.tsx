'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Copy, CreditCard, LockKeyhole, MapPin, ShieldCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { Product } from '@/lib/types';
import { formatBRL } from '@/lib/format';
import { useCart } from '@/components/cart';
import { trackMeta } from '@/components/meta-pixel';

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

type CardPayment = {
  orderId: string;
  total: number;
  installments: number;
  last4: string;
  status: string;
};

export function CheckoutForm({
  addons = [],
  checkoutEnabled = false,
  initialPayment = 'credit_card',
}: {
  addons?: Product[];
  checkoutEnabled?: boolean;
  initialPayment?: 'credit_card' | 'pix';
}) {
  const { lines, total, clear } = useCart();
  const [payment, setPayment] = useState<'credit_card' | 'pix'>(initialPayment);
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [installments, setInstallments] = useState(1);
  const [cardPayment, setCardPayment] = useState<CardPayment | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'error' | 'success'>('error');
  const [cep, setCep] = useState('');
  const [document, setDocument] = useState('');
  const [address, setAddress] = useState({ street: '', neighborhood: '', city: '', state: '' });
  const [pixPayment, setPixPayment] = useState<PixPayment | null>(null);
  const [copied, setCopied] = useState(false);
  const purchaseTracked = useRef(false);
  const fullTotal = total;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const p = params.get('payment');
      if (p === 'pix') {
        setPayment('pix');
      } else if (p === 'credit_card') {
        setPayment('credit_card');
      }
    }
  }, []);

  const formatCardNumber = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  };

  const formatCardExpiry = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) {
      return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    return digits;
  };

  const detectBrand = (val: string) => {
    const digits = val.replace(/\D/g, '');
    if (/^4/.test(digits)) return 'visa';
    if (/^(5[1-5]|2[2-7])/.test(digits)) return 'mastercard';
    if (/^(4011|4389|4514|4576|5041|5066|5067|509|6277|6362|6363|650|6516|6550)/.test(digits)) return 'elo';
    if (/^3[47]/.test(digits)) return 'amex';
    return '';
  };

  const detectedBrand = detectBrand(cardNumber);

  const installmentOptions = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const count = i + 1;
      const val = fullTotal / count;
      return {
        count,
        valuePerInstallment: val,
        label: count === 1
          ? `1x de ${formatBRL(fullTotal)} (à vista sem acréscimo)`
          : `${count}x de ${formatBRL(val)} sem acréscimo`,
      };
    });
  }, [fullTotal]);

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
        // Falha transitória não altera o pagamento; a próxima consulta tenta novamente.
      }
    };

    // Consulta inicial e imediata ao focar na janela / voltar do aplicativo do banco
    checkStatus();
    const onVisibilityChange = () => {
      if (typeof window !== 'undefined' && window.document?.visibilityState === 'visible') checkStatus();
    };
    window.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', checkStatus);

    // Consulta ativa e dinâmica a cada 3.5 segundos para garantir detecção rápida
    const timer = window.setInterval(checkStatus, 3500);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', checkStatus);
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
    const items = lines.map(line => ({ slug: line.product.slug, quantity: line.quantity, variant: line.variant }));
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
      creditCard: payment === 'credit_card' ? {
        cardNumber: cardNumber.replace(/\s/g, ''),
        cardHolder,
        expiry: cardExpiry,
        cvv: cardCvv,
        installments,
        installmentValue: Number((fullTotal / installments).toFixed(2)),
      } : undefined,
      items,
      downsellAccepted: false,
    };

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });
      const data = await response.json();
      if (!response.ok || !data.saved) {
        setMessage(data.message || 'Não foi possível processar o pedido. Verifique os dados e tente novamente.');
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

      if (data.paymentMethod === 'credit_card' || payment === 'credit_card') {
        const createdCard: CardPayment = {
          orderId: String(data.orderId || `PED-${Date.now().toString().slice(-6)}`),
          total: fullTotal,
          installments: data.installments || installments,
          last4: data.cardLast4 || (cardNumber.replace(/\D/g, '').slice(-4) || '****'),
          status: data.status || 'pago',
        };
        setCardPayment(createdCard);
        purchaseTracked.current = true;
        trackMeta('Purchase', { value: fullTotal, currency: 'BRL' });
        clear();
        sessionStorage.removeItem('bomlar-checkout-id');
        setMessage(data.message || 'Pagamento no cartão aprovado!');
        setMessageType('success');
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
      setMessage('Não foi possível confirmar o pedido. Aguarde antes de tentar novamente.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  }

  if (cardPayment) {
    return (
      <section className="panel card-payment-panel" aria-live="polite">
        <span className="eyebrow">Pagamento confirmado</span>
        <h2 className="page-title" style={{ fontSize: 25, margin: '8px 0 8px' }}>
          Pedido pago com sucesso!
        </h2>
        <p className="muted">
          Pedido #{cardPayment.orderId} · {formatBRL(cardPayment.total)}
        </p>

        <div className="notice success-notice" style={{ padding: 22, textAlign: 'center', fontSize: 14, marginTop: 16 }}>
          <strong>✓ Pagamento aprovado no Cartão de Crédito!</strong>
          <p style={{ margin: '8px 0 0', color: '#c7e9d2' }}>
            Parcelado em <strong>{cardPayment.installments}x de {formatBRL(cardPayment.total / cardPayment.installments)} sem acréscimo</strong>.
          </p>
          <p style={{ margin: '6px 0 0', color: '#a0aec0', fontSize: 12 }}>
            Cartão com final {cardPayment.last4} · Aprovação imediata
          </p>
          <p style={{ margin: '12px 0 0', color: '#e2e8f0', fontSize: 13 }}>
            Seu pedido foi registrado e está sendo preparado para envio. Obrigado pela sua compra na Bom Lar!
          </p>
        </div>

        <div style={{ display: 'grid', gap: 6, marginTop: 18, padding: 14, background: '#111318', border: '1px solid #202738', borderRadius: 9, fontSize: 12, color: '#a0aec0' }}>
          <div><strong style={{ color: '#fff' }}>1.</strong> Enviamos os detalhes da compra para seu e-mail e WhatsApp cadastrados.</div>
          <div><strong style={{ color: '#fff' }}>2.</strong> O código de rastreamento será enviado assim que a encomenda for despachada.</div>
          <div><strong style={{ color: '#fff' }}>3.</strong> Qualquer dúvida, nosso time de suporte está à sua disposição.</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 22 }}>
          <Link className="btn-primary" href="/">
            Voltar à loja
          </Link>
        </div>
      </section>
    );
  }

  if (pixPayment) {
    const paid = pixPayment.status === 'pago';
    const expired = ['cancelado', 'expirado', 'reembolsado', 'falhou'].includes(pixPayment.status);
    return <section className="panel pix-payment-panel" aria-live="polite">
      <span className="eyebrow">{paid ? 'Pagamento confirmado' : expired ? 'Pix encerrado' : 'Aguardando pagamento'}</span>
      <h2 className="page-title" style={{ fontSize: 25, margin: '8px 0 8px' }}>{paid ? 'Pedido pago com sucesso!' : expired ? 'Este Pix não está mais ativo.' : 'Pague com Pix'}</h2>
      <p className="muted">Pedido {pixPayment.orderId} · {formatBRL(pixPayment.amountCents / 100)}</p>
      {!paid && !expired && <>
        <div className="live-status-pulse">
          <span className="pulse-dot" />
          <span>Aguardando confirmação do pagamento no seu banco…</span>
        </div>
        <div className="pix-qr-wrap">
          <QRCodeSVG value={pixPayment.copyPaste} size={240} level="M" includeMargin bgColor="#ffffff" fgColor="#0A0A0A" aria-label="QR Code de pagamento Pix" />
        </div>
        {pixPayment.expiresAt && <p className="muted" style={{ textAlign: 'center', fontSize: 12 }}>Válido até {new Date(pixPayment.expiresAt).toLocaleString('pt-BR')}</p>}
        <label className="field pix-copy-field">
          <span style={{ fontWeight: 600 }}>Pix Copia e Cola</span>
          <textarea readOnly value={pixPayment.copyPaste} rows={4} onFocus={event => event.currentTarget.select()} onClick={event => event.currentTarget.select()} />
        </label>
        <button type="button" className="btn-pix pix-copy-button" onClick={copyPixCode}>
          {copied ? <Check size={18} /> : <Copy size={18} />}
          {copied ? 'Código Pix copiado!' : 'Copiar código Pix (Copia e Cola)'}
        </button>
        <div style={{ display: 'grid', gap: 6, marginTop: 16, padding: 14, background: '#111318', border: '1px solid #202738', borderRadius: 9, fontSize: 12, color: '#a0aec0' }}>
          <div><strong style={{ color: '#fff' }}>1.</strong> Abra o aplicativo do seu banco no celular.</div>
          <div><strong style={{ color: '#fff' }}>2.</strong> Escolha <em>Pagar com Pix</em> e aponte a câmera para o QR Code ou use o <em>Pix Copia e Cola</em>.</div>
          <div><strong style={{ color: '#fff' }}>3.</strong> Assim que você pagar, esta tela identificará o pagamento automaticamente em tempo real!</div>
        </div>
        <p className="muted" style={{ textAlign: 'center', fontSize: 11, marginTop: 12 }}>Atualização em tempo real sincronizada diretamente com a IronPay.</p>
      </>}
      {paid && <div className="notice success-notice" style={{ padding: 20, textAlign: 'center', fontSize: 14 }}>
        <strong>✓ Pagamento confirmado pela IronPay!</strong>
        <p style={{ margin: '8px 0 0', color: '#c7e9d2' }}>Seu pedido foi registrado e está pronto para envio. Obrigado pela sua compra na Bom Lar!</p>
      </div>}
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

      {payment === 'credit_card' ? (
        <>
          <h2 style={{ marginTop: 27 }}>Pagamento com Cartão de Crédito</h2>
          <div className="payment-option-card active card-active" style={{ cursor: 'default' }}>
            <div className="payment-card-content">
              <div className="payment-card-title">
                <span className="card-tag">CARTÃO</span>
                <strong>Cartão de Crédito · Compra Protegida</strong>
              </div>
              <p>Até 12x de {formatBRL(fullTotal / 12)} sem acréscimo. Liberação imediata e segurança ponta a ponta.</p>
            </div>
          </div>

          <div className="credit-card-fields-box">
            <div className="card-fields-header">
              <div className="card-fields-title-wrap">
                <CreditCard size={18} style={{ color: '#3b82f6' }} />
                <div>
                  <strong>Dados do Cartão de Crédito</strong>
                  <span>Parcelamento em até 12x sem juros ou acréscimo</span>
                </div>
              </div>
              <div className="card-brands-icons">
                <span className={`brand-chip ${detectedBrand === 'visa' ? 'active' : ''}`}>VISA</span>
                <span className={`brand-chip ${detectedBrand === 'mastercard' ? 'active' : ''}`}>MASTERCARD</span>
                <span className={`brand-chip ${detectedBrand === 'elo' ? 'active' : ''}`}>ELO</span>
                <span className={`brand-chip ${detectedBrand === 'amex' ? 'active' : ''}`}>AMEX</span>
              </div>
            </div>

            <div className="form-grid" style={{ marginTop: 14 }}>
              <Field label="Número do cartão" full>
                <input
                  required={payment === 'credit_card'}
                  value={cardNumber}
                  onChange={e => setCardNumber(formatCardNumber(e.target.value))}
                  placeholder="0000 0000 0000 0000"
                  maxLength={19}
                  inputMode="numeric"
                  autoComplete="cc-number"
                />
              </Field>

              <Field label="Nome impresso no cartão" full>
                <input
                  required={payment === 'credit_card'}
                  value={cardHolder}
                  onChange={e => setCardHolder(e.target.value.toUpperCase())}
                  placeholder="Como está gravado no cartão"
                  autoComplete="cc-name"
                />
              </Field>

              <Field label="Validade">
                <input
                  required={payment === 'credit_card'}
                  value={cardExpiry}
                  onChange={e => setCardExpiry(formatCardExpiry(e.target.value))}
                  placeholder="MM/AA"
                  maxLength={5}
                  inputMode="numeric"
                  autoComplete="cc-exp"
                />
              </Field>

              <Field label="CVV">
                <input
                  required={payment === 'credit_card'}
                  value={cardCvv}
                  onChange={e => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="123"
                  maxLength={4}
                  inputMode="numeric"
                  autoComplete="cc-csc"
                />
              </Field>

              <Field label="Parcelamento em até 12x (sem acréscimo)" full>
                <select
                  value={installments}
                  onChange={e => setInstallments(Number(e.target.value))}
                  className="installments-select"
                >
                  {installmentOptions.map(opt => (
                    <option key={opt.count} value={opt.count}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        </>
      ) : (
        <>
          <h2 style={{ marginTop: 27 }}>Pagamento via Pix</h2>
          <div className="payment-option-card active" style={{ cursor: 'default' }}>
            <div className="payment-card-content">
              <div className="payment-card-title">
                <span className="pix-tag">PIX</span>
                <strong>Pix · Aprovação Imediata</strong>
              </div>
              <p>QR Code dinâmico e código Pix Copia e Cola gerados na hora com o valor de {formatBRL(fullTotal)} via IronPay.</p>
            </div>
          </div>
        </>
      )}

      {message && <p className={`notice ${messageType === 'success' ? 'success-notice' : 'error-notice'}`} role="status">{message}</p>}

      {payment === 'pix' ? (
        <button className="btn-pix checkout-submit" style={{ marginTop: 18 }} type="submit" disabled={loading}>
          {loading ? 'Gerando Pix pela IronPay…' : <><LockKeyhole size={16} /> Pagar com Pix · {formatBRL(fullTotal)}</>}
        </button>
      ) : (
        <button className="btn-primary checkout-submit btn-card-submit" style={{ marginTop: 18 }} type="submit" disabled={loading}>
          {loading ? (
            'Processando cartão de crédito…'
          ) : (
            <>
              <LockKeyhole size={16} /> Finalizar compra em {installments}x de {formatBRL(fullTotal / installments)} sem acréscimo
            </>
          )}
        </button>
      )}

      <p style={{ fontSize: 9, color: '#8b8d93', textAlign: 'center', marginTop: 14 }}><ShieldCheck size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Seus dados são enviados de forma protegida.</p>
    </form>

    <aside><div className="panel">
      <h2>Resumo do pedido</h2>
      {lines.map(line => <div className="checkout-summary-line" key={`${line.product.id}:${line.variant ?? ''}`}>
        <span>{line.quantity} × {line.product.title}</span>
        <b>{formatBRL((line.product.price + (line.product.variants.find(variant => variant.value === line.variant)?.priceExtra ?? 0)) * line.quantity)}</b>
      </div>)}
      <div className="checkout-summary-line"><span>Frete</span><b>{fullTotal >= 99 ? 'Grátis' : 'Calculado pelo CEP'}</b></div>
      <div className="checkout-summary-line" style={{ fontWeight: 700 }}><span>Total</span><b>{formatBRL(fullTotal)}</b></div>
      <p className="muted" style={{ fontSize: 10 }}>Frete grátis em compras a partir de R$ 99.</p>
    </div></aside>
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
