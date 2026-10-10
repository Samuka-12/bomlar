'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Minus, Plus, Search, ShoppingBag, X, Trash2 } from 'lucide-react';
import type { CartLine, Product } from '@/lib/types';
import { formatBRL } from '@/lib/format';

type CartContextValue = {
  lines: CartLine[];
  count: number;
  total: number;
  add: (product: Product, variant?: string) => void;
  update: (id: string, quantity: number, variant?: string) => void;
  remove: (id: string, variant?: string) => void;
  clear: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
};
const CartContext = createContext<CartContextValue | null>(null);
export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart precisa estar dentro de CartProvider');
  return value;
}
export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { const saved = localStorage.getItem('bomlar-cart'); if (saved) setLines(JSON.parse(saved) as CartLine[]); } catch { localStorage.removeItem('bomlar-cart'); }
  }, []);
  useEffect(() => { localStorage.setItem('bomlar-cart', JSON.stringify(lines)); }, [lines]);
  const value = useMemo<CartContextValue>(() => ({
    lines,
    count: lines.reduce((sum, item) => sum + item.quantity, 0),
    total: lines.reduce((sum, item) => sum + item.quantity * (item.product.price + (item.product.variants.find(v => v.value === item.variant)?.priceExtra ?? 0)), 0),
    add: (product, variant) => setLines((current) => {
      const key = `${product.id}:${variant ?? ''}`;
      const found = current.find((line) => `${line.product.id}:${line.variant ?? ''}` === key);
      return found ? current.map((line) => `${line.product.id}:${line.variant ?? ''}` === key ? { ...line, quantity: line.quantity + 1 } : line) : [...current, { product, quantity: 1, variant }];
    }),
    update: (id, quantity, variant) => setLines((current) => quantity <= 0 ? current.filter((line) => !(line.product.id === id && line.variant === variant)) : current.map((line) => line.product.id === id && line.variant === variant ? { ...line, quantity } : line)),
    remove: (id, variant) => setLines((current) => current.filter((line) => !(line.product.id === id && line.variant === variant))),
    clear: () => setLines([]),
    open,
    setOpen,
  }), [lines, open]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

function Mark() { return <svg className="brand-mark" viewBox="0 0 32 30" fill="none" aria-hidden="true"><path d="M3 13 16 3l13 10v14H3V13Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"/><path d="M9 19h14M9 23h14M11 15h10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/><path d="M16 3v6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>; }

export function SiteHeader() {
  const { count, setOpen } = useCart();
  const pathname = usePathname();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const isHome = pathname === '/';

  const onSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const query = searchTerm.trim();
    if (query) {
      router.push(`/?busca=${encodeURIComponent(query)}`);
    } else {
      router.push('/');
    }
  };

  return <header className="site-header">
    {isHome && <div className="announcement">Frete grátis a partir de R$ 99 · Envio para todo o Brasil</div>}
    <div className="wrap nav-row">
      <Link href="/" className="brand" aria-label="Bom Lar, início"><Mark/><span>Bom</span> Lar</Link>
      <form className="searchbox" onSubmit={onSearchSubmit} role="search">
        <Search size={16}/>
        <input 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)} 
          placeholder="O que você procura para sua casa?" 
          aria-label="Buscar produtos"
        />
        {searchTerm && (
          <button 
            type="button" 
            onClick={() => { setSearchTerm(''); if (isHome) router.push('/'); }} 
            className="icon-button" 
            style={{ width: 22, height: 22, border: 0, background: 'transparent', color: '#999' }}
            aria-label="Limpar busca"
          >
            <X size={13} />
          </button>
        )}
        <button className="icon-button" type="submit" aria-label="Buscar" style={{width:28,height:28,border:0,background:'transparent'}}><Search size={15}/></button>
      </form>
      <div className="nav-actions">
        <Link className="text-link" href="/#categorias">Categorias</Link>
        <Link className="text-link" href="/admin">Minha conta</Link>
        <button className="cart-trigger" onClick={() => setOpen(true)} aria-label={`Abrir carrinho, ${count} itens`}>
          <ShoppingBag size={17}/>
          <span className="cart-label">Sacola</span>
          <span className="cart-count">{count}</span>
        </button>
      </div>
    </div>
    <div className="wrap mobile-search">
      <form className="searchbox" onSubmit={onSearchSubmit} role="search">
        <Search size={15}/>
        <input 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)} 
          placeholder="Buscar achadinhos para casa..." 
          aria-label="Buscar produtos"
        />
        {searchTerm && (
          <button 
            type="button" 
            onClick={() => { setSearchTerm(''); if (isHome) router.push('/'); }} 
            className="icon-button" 
            style={{ width: 22, height: 22, border: 0, background: 'transparent', color: '#999' }}
            aria-label="Limpar busca"
          >
            <X size={13} />
          </button>
        )}
      </form>
    </div>
  </header>;
}
export function CartDrawer() {
  const { open, setOpen, lines, total, update, remove } = useCart();
  if (!open) return null;
  const free = Math.max(0, 99 - total);
  return <><button className="drawer-backdrop" aria-label="Fechar sacola" onClick={() => setOpen(false)}/><aside className="cart-drawer" role="dialog" aria-modal="true" aria-label="Sacola de compras">
    <div className="drawer-head"><h2>Sua sacola <span className="muted">({lines.reduce((n,l)=>n+l.quantity,0)})</span></h2><button className="icon-button" onClick={() => setOpen(false)} aria-label="Fechar"><X size={17}/></button></div>
    {lines.length ? <>
      <div className="cart-progress">{free ? <>Faltam <b>{formatBRL(free)}</b> para o frete grátis</> : <b>Você ganhou frete grátis</b>}<div className="cart-progress-track" style={{marginTop:9}}><div className="cart-progress-fill" style={{width:`${Math.min(100,total/99*100)}%`}}/></div></div>
      <div className="drawer-lines">{lines.map(({product,quantity,variant})=><div className="cart-line" key={`${product.id}-${variant??''}`}>{product.images[0]?<img src={product.images[0]} alt={product.title}/>:<span className="product-image-empty">Sem foto</span>}<div><h3>{product.title}</h3><p>{formatBRL(product.price + (product.variants.find(v=>v.value===variant)?.priceExtra ?? 0))}{variant ? ` · ${variant}` : ''}</p><div className="qty-controls"><button onClick={()=>update(product.id,quantity-1,variant)} aria-label="Diminuir">−</button><span>{quantity}</span><button onClick={()=>update(product.id,quantity+1,variant)} aria-label="Aumentar">+</button></div></div><button className="icon-button" style={{width:30,height:30}} onClick={()=>remove(product.id,variant)} aria-label="Remover"><Trash2 size={14}/></button></div>)}</div>
      <div className="drawer-total"><div className="drawer-total-row"><span>Subtotal</span><span>{formatBRL(total)}</span></div><div className="drawer-total-row"><span>Frete</span><span>{free ? 'Calculado no checkout' : 'Grátis'}</span></div><div className="drawer-total-row total"><span>Total parcial</span><span>{formatBRL(total)}</span></div><Link href="/checkout" onClick={()=>setOpen(false)} className="btn-primary btn-block">Ir para o checkout <span>→</span></Link><p style={{textAlign:'center',color:'#86888e',fontSize:9}}>Pagamento protegido · Pix e cartão</p></div>
    </> : <div className="empty-cart"><div><ShoppingBag size={29}/><strong>Sua sacola está vazia</strong><p>Encontre um achadinho para organizar sua casa.</p><button className="btn-primary" onClick={()=>setOpen(false)}>Ver produtos</button></div></div>}
  </aside></>;
}
export function SiteFooter() {
  return <footer className="site-footer"><div className="wrap"><div className="footer-grid">
    <div className="footer-brand"><Link href="/" className="brand"><Mark/><span>Bom</span> Lar</Link><p>Achadinhos práticos para uma casa mais leve, bonita e organizada.</p><strong style={{font:'600 11px Sora',color:'#c7c9cf'}}>Um bom lar começa com organização.</strong></div>
    <div className="footer-col"><h3>Explore</h3><Link href="/#categorias">Categorias</Link><Link href="/#ofertas">Ofertas do dia</Link><Link href="/#produtos">Todos os produtos</Link><Link href="/#sobre">Sobre a Bom Lar</Link></div>
    <div className="footer-col"><h3>Atendimento</h3><p>Ajuda com pedidos</p><p>Envio para todo o Brasil</p><p>Segunda a sábado</p></div>
    <div className="footer-col"><h3>Compra segura</h3><p>Pagamento protegido</p><p>Política de trocas</p><p>Privacidade e dados</p></div>
  </div><div className="footer-bottom"><span>© {new Date().getFullYear()} Bom Lar. Todos os direitos reservados.</span><span>Feito para deixar a rotina mais leve.</span></div></div></footer>;
}
