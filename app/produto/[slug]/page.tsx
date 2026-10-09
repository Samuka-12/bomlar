import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProduct, getProducts } from '@/lib/catalog';
import { ProductDetail } from '@/components/product-detail';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const{slug}=await params;const product=await getProduct(slug);if(!product)return{title:'Produto não encontrado',robots:{index:false,follow:false}};const images=product.images.filter(image=>/^https:\/\//i.test(image));return{title:product.title,description:product.description.slice(0,155),openGraph:{type:'website',title:`${product.title} | Bom Lar`,description:product.description.slice(0,155),...(images.length?{images}: {})},twitter:{card:images.length?'summary_large_image':'summary',...(images.length?{images}: {})}};}
export default async function ProductPage({params}:{params:Promise<{slug:string}>}){const{slug}=await params;const products=await getProducts();const product=products.find(p=>p.slug===slug);if(!product)notFound();const related=products.filter(p=>p.id!==product.id&&(p.category===product.category||p.tags.some(tag=>product.tags.includes(tag)))).slice(0,4).map(p=>({...p,description:'',images:p.images.slice(0,1),imageCount:p.images.length,reviews:[]}));return <ProductDetail product={product} related={related}/>;}
