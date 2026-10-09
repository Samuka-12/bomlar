'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Plus, ShieldCheck, Truck, ZoomIn } from 'lucide-react';
import type { Product } from '@/lib/types';
import { formatBRL } from '@/lib/format';
import { ProductCard } from '@/components/storefront';
import { useCart } from '@/components/cart';
import { trackMeta } from '@/components/meta-pixel';

export function ProductDetail({product,related=[]}:{product:Product;related?:Product[]}) {
  const { add,setOpen }=useCart(); const [image,setImage]=useState(0); const [variant,setVariant]=useState(product.variants[0]?.value??''); const [zoom,setZoom]=useState(false);
  const selectedVariant=product.variants.find(v=>v.value===variant);const unavailable=product.available===false||product.stock===0||selectedVariant?.available===false;const price=product.price+(selectedVariant?.priceExtra??0);
  const discount=product.compareAt&&product.compareAt>price?Math.round((1-price/product.compareAt)*100):0;
  useEffect(()=>{trackMeta('ViewContent',{content_type:'product',content_ids:[product.id],value:price,currency:'BRL'})},[product.id,price]);
  const buy=()=>{trackMeta('AddToCart',{content_type:'product',content_ids:[product.id],value:price,currency:'BRL'});add(product,variant||undefined);setOpen(true)};
  return <main className="section"><div className="wrap"><Link href="/#produtos" className="link-blue"><ArrowLeft size={14}/> Voltar aos achadinhos</Link><div className="product-detail-grid" style={{display:'grid',gridTemplateColumns:'minmax(0,1.05fr) minmax(300px,.95fr)',gap:42,marginTop:23,alignItems:'start'}}>
    <div>
      <button className="detail-image" disabled={!product.images.length} onClick={()=>setZoom(true)} aria-label="Ampliar imagem" style={{position:'relative',width:'100%',aspectRatio:'1/1',border:'1px solid #2a2a2a',borderRadius:14,overflow:'hidden',background:'#171717',padding:0}}>
        {product.images[image] ? <img src={product.images[image]} alt={product.title} style={{width:'100%',height:'100%',objectFit:'contain'}}/> : <span className="product-image-empty">Foto indisponível</span>}
        {product.images.length > 0 && <span className="image-counter" aria-live="polite">{image + 1} / {product.images.length} fotos</span>}
        <span className="zoom-tag"><ZoomIn size={14}/> Ampliar</span>
      </button>
      <div className="detail-thumbs" aria-label={`Galeria com ${product.images.length} fotos`}>
        {product.images.map((url,i)=><button key={`${url}-${i}`} onClick={()=>setImage(i)} aria-label={`Foto ${i+1} de ${product.images.length}`} aria-current={i===image?'true':undefined} style={{border:i===image?'1px solid #1f5bff':'1px solid #292929'}}><img src={url} alt={`${product.title}, imagem ${i+1}`} loading="lazy"/></button>)}
      </div>
    </div>
    <div className="product-detail-copy"><span className="eyebrow">{product.category} · Bom Lar</span><h1 className="page-title">{product.title}</h1>{product.rating&&product.reviewCount>0?<div className="rating-line">★★★★★ <span>{product.rating.toFixed(1)} · {product.reviewCount} avaliações</span></div>:<div className="rating-line"><span className="muted">Produto selecionado pela Bom Lar</span></div>}
      <div className="detail-price">{product.compareAt&&product.compareAt>price&&<span className="product-old">{formatBRL(product.compareAt)}</span>}<strong>{formatBRL(price)}</strong>{discount>0&&<span className="product-save">-{discount}%</span>}</div><div className="product-installments">ou até 12x de {formatBRL(price/12)} sem juros</div>
      {product.stock!==null&&product.stock<=5&&<div className="stock-pill">Últimas {product.stock} unidades disponíveis</div>}
      {product.variants.length>1&&<div className="field" style={{marginTop:23}}><label htmlFor="variant">Escolha a opção</label><select id="variant" value={variant} onChange={e=>setVariant(e.target.value)}>{product.variants.map((v,i)=><option disabled={v.available===false} key={`${v.value}-${i}`} value={v.value}>{v.value}{v.priceExtra?` (+ ${formatBRL(v.priceExtra)})`:""}{v.available===false?" · esgotado":""}</option>)}</select></div>}
      <button className="btn-primary buy-button" disabled={unavailable} onClick={buy}><Plus size={17}/> {unavailable?"Indisponível":"Quero esse achadinho"}</button><div className="detail-perks"><div><Truck size={17}/> Frete grátis em pedidos acima de R$ 99</div><div><ShieldCheck size={17}/> Dados protegidos durante a compra</div><div><Check size={17}/> Seleção prática para sua casa</div></div>
      <details open className="detail-description"><summary>Sobre este produto</summary><p>{product.description}</p></details><details className="detail-description"><summary>Entrega e pagamento</summary><p>Informe seu CEP no checkout para consultar opções de envio. Pix e cartão estão preparados para integração com o gateway da loja.</p></details>
    </div></div>
    {product.reviews?.length? <section className="section-tight"><div className="section-head"><h2>Avaliações deste produto</h2></div><div className="review-rail">{product.reviews.slice(0,8).map((review,i)=><article className="review-card" key={i}><span>{'★'.repeat(Math.round(review.rating))}</span><p>“{review.body}”</p><b>{review.author||'Cliente'}</b></article>)}</div></section>:null}
    {related.length>0&&<section className="section-tight"><div className="section-head"><h2>Você também pode gostar</h2></div><div className="product-rail">{related.map(p=><ProductCard key={p.id} product={p}/>)}</div></section>}
    {zoom&&<div className="image-zoom" role="dialog" aria-modal="true" onClick={()=>setZoom(false)}><button className="icon-button" onClick={()=>setZoom(false)} aria-label="Fechar imagem">×</button><img src={product.images[image]} alt={product.title}/></div>}
    <div className="mobile-buybar"><div><span>{product.title}</span><b>{formatBRL(price)}</b></div><button className="btn-primary" disabled={unavailable} onClick={buy}>{unavailable?"Indisponível":"Comprar"}</button></div>
  </div></main>;
}
