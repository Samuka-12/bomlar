import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import he from 'he';

const BASE = 'https://lojamaxlarapp.com';
const OUT_DATA = path.resolve('lib/demo-catalog.json');
const OUT_IMAGES = path.resolve('public/products');
const STAGING = path.resolve('public/products-staging');
const HEADERS = { 'User-Agent': 'BomLarCatalogPreview/1.0', Accept: 'application/json' };

async function getJson(url) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(35000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function fetchList(route, key) {
  const result = [];
  for (let page = 1; page <= 20; page++) {
    const separator = route.includes('?') ? '&' : '?';
    const payload = await getJson(`${BASE}${route}${separator}limit=250&page=${page}`);
    const rows = payload[key] ?? [];
    result.push(...rows);
    if (rows.length < 250) break;
  }
  return result;
}

async function mapLimit(items, limit, fn) {
  const output = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      output[index] = await fn(items[index], index);
    }
  }));
  return output;
}

function cleanText(value = '') {
  let text = String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\s*br\b[^>]*>/gi, ' ')
    .replace(/<\/(?:p|div|li|h[1-6])\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  text = he.decode(text)
    .replace(/\bmax[\s_-]*lar\b/gi, 'Bom Lar')
    .replace(/[\u200b-\u200f\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 3500 ? `${text.slice(0, 3499).trimEnd()}…` : text;
}

function slugify(value) {
  return cleanText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function allowedImage(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (
      url.hostname === 'cdn.shopify.com' ||
      url.hostname === 'images.shopifycdn.net' ||
      url.hostname.endsWith('.shopifycdn.com')
    );
  } catch {
    return false;
  }
}

function normalizeTags(product, category, isBestSeller) {
  const source = Array.isArray(product.tags)
    ? product.tags
    : typeof product.tags === 'string'
      ? product.tags.split(',')
      : [];
  const tags = source.map(tag => cleanText(tag).toLowerCase()).filter(Boolean);
  const text = `${product.title ?? ''} ${product.body_html ?? ''} ${product.product_type ?? ''} ${category}`.toLowerCase();
  const rooms = [
    ['cozinha', /cozinha|geladeira|micro-ondas|fruteira|condimento|tábua|talher|panela|pote/],
    ['banheiro', /banheiro|chuveiro|vaso sanitário|pia|box|toalha/],
    ['quarto', /quarto|travesseiro|cama|guarda-roupa|cabide|colchão/],
    ['lavanderia', /lavanderia|roupa suja|cesto de roupa|varal|sabão|passar roupa/],
    ['sala', /sala|sofá|rack|televisão|tv|decoração/],
    ['externa', /jardim|varanda|externo|área externa|plantas|suporte para plantas/],
  ];
  for (const [tag, pattern] of rooms) if (pattern.test(text)) tags.push(tag);
  if (/organiz|armazen|compact|gaveta|empilh|multiuso|multifunc|aproveitar espaço/.test(text)) tags.push('espaco-pequeno', 'organizacao');
  if (/gaveta|divis[oó]ria|separador/.test(text)) tags.push('gaveta');
  if (isBestSeller) tags.push('mais-vendido');
  const normalizedCategory = cleanText(category).toLowerCase();
  if (normalizedCategory) tags.push(normalizedCategory);
  return [...new Set(tags)];
}

function collectionCategoryNames(collections, memberships, id) {
  return (memberships.get(String(id)) ?? [])
    .filter(collection => !['frontpage', 'mais-vendidos', 'all'].includes(collection.handle))
    .map(collection => cleanText(collection.title));
}

function chooseCategory(product, collectionsForProduct) {
  const type = cleanText(product.product_type ?? '');
  if (type && type.length <= 48 && !/(organizadores).*(organizadores)/i.test(type)) return type;
  const preferred = collectionsForProduct.find(name => /cozinha|decora|mesa|m[oó]veis|pratos|banheiro|quarto|lavanderia/i.test(name));
  if (preferred) return preferred;
  return 'Organização';
}

async function downloadPreviewImage(url, destination) {
  if (!allowedImage(url)) throw new Error('Host de imagem fora da lista autorizada');
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'BomLarCatalogPreview/1.0' },
        signal: AbortSignal.timeout(35000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const input = Buffer.from(await response.arrayBuffer());
      if (input.length > 60 * 1024 * 1024) throw new Error('Imagem excede 60 MiB');
      const webp = await sharp(input)
        .rotate()
        .resize({ width: 1100, height: 1100, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 76, effort: 4 })
        .toBuffer();
      await fs.writeFile(destination, webp);
      return webp.length;
    } catch (error) {
      lastError = error;
      if (attempt < 4) await new Promise(resolve => setTimeout(resolve, 500 * attempt));
    }
  }
  throw lastError;
}

async function main() {
  const [products, collections] = await Promise.all([
    fetchList('/collections/all/products.json', 'products'),
    fetchList('/collections.json', 'collections'),
  ]);
  if (!products.length) throw new Error('A coleção pública retornou zero produtos; arquivos existentes foram preservados.');

  const uniqueProducts = [];
  const seenIds = new Set();
  let duplicateIds = 0;
  for (const product of products) {
    const id = String(product.id ?? '');
    if (!id || seenIds.has(id)) { duplicateIds++; continue; }
    seenIds.add(id);
    uniqueProducts.push(product);
  }

  const membership = new Map();
  const categoryCollections = collections.filter(collection => !['frontpage', 'mais-vendidos', 'all'].includes(collection.handle));
  const bestSellerCollection = collections.find(collection => collection.handle === 'mais-vendidos');
  const allCollections = [...categoryCollections, ...(bestSellerCollection ? [bestSellerCollection] : [])];
  const bestSellerIds = new Set();
  await mapLimit(allCollections, 4, async collection => {
    try {
      const rows = await fetchList(`/collections/${encodeURIComponent(collection.handle)}/products.json`, 'products');
      for (const product of rows) {
        const id = String(product.id);
        if (!membership.has(id)) membership.set(id, []);
        membership.get(id).push(collection);
        if (collection.handle === 'mais-vendidos') bestSellerIds.add(id);
      }
    } catch {
      // A falha de uma coleção opcional não impede a listagem completa de /collections/all.
    }
  });

  const usedSlugs = new Set();
  const slugById = new Map();
  for (const product of uniqueProducts) {
    const id = String(product.id);
    const base = slugify(product.title) || `produto-${slugify(id)}`;
    let slug = base;
    if (usedSlugs.has(slug)) slug = `${base.slice(0, 78)}-${slugify(id).slice(0, 10)}`;
    if (usedSlugs.has(slug)) slug = `produto-${slugify(id)}`;
    usedSlugs.add(slug);
    slugById.set(id, slug);
  }

  await fs.rm(STAGING, { recursive: true, force: true });
  await fs.mkdir(STAGING, { recursive: true });
  let imagesDownloaded = 0;
  let imagesFailed = 0;
  let duplicatePhotoUrlsSkipped = 0;
  let productsWithoutPhotos = 0;
  let webpBytes = 0;
  let imageAttempts = 0;
  const imagePathsById = new Map(uniqueProducts.map(product => [String(product.id), []]));
  const imageJobs = [];
  for (const product of uniqueProducts) {
    const id = String(product.id);
    const slug = slugById.get(id);
    const seen = new Set();
    let photoIndex = 0;
    for (const item of product.images ?? []) {
      const sourceUrl = typeof item?.src === 'string' ? item.src : '';
      if (!sourceUrl || !allowedImage(sourceUrl)) { imagesFailed++; continue; }
      const source = new URL(sourceUrl);
      const canonicalUrl = `${source.origin}${source.pathname}`;
      if (seen.has(canonicalUrl)) { duplicatePhotoUrlsSkipped++; continue; }
      seen.add(canonicalUrl);
      const index = photoIndex++;
      const suffix = index === 0 ? '' : `-${String(index + 1).padStart(2, '0')}`;
      const fileName = `${slug}${suffix}.webp`;
      imageJobs.push({ id, sourceUrl, fileName, index });
    }
    if (photoIndex === 0) productsWithoutPhotos++;
  }

  const imageResults = await mapLimit(imageJobs, 8, async job => {
    let result = null;
    try {
      const bytes = await downloadPreviewImage(job.sourceUrl, path.join(STAGING, job.fileName));
      imagesDownloaded++;
      webpBytes += bytes;
      result = { id: job.id, index: job.index, path: `/products/${job.fileName}` };
    } catch (error) {
      imagesFailed++;
      console.warn(`Falha na foto ${job.fileName}: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
    } finally {
      imageAttempts++;
      if (imageAttempts % 25 === 0 || imageAttempts === imageJobs.length) {
        console.log(`Fotos locais processadas: ${imageAttempts}/${imageJobs.length}; baixadas: ${imagesDownloaded}; falhas: ${imagesFailed}`);
      }
    }
    return result;
  });
  for (const result of imageResults) {
    if (result) imagePathsById.get(result.id).push(result.path);
  }
  if (imagesFailed > 0 || productsWithoutPhotos > 0) {
    throw new Error(`Galeria incompleta: ${imagesFailed} fotos falharam/foram rejeitadas e ${productsWithoutPhotos} produtos ficaram sem foto; o catálogo existente foi preservado.`);
  }

  const categories = new Set();
  const demo = [];
  for (const product of uniqueProducts) {
    const id = String(product.id);
    const sourceVariants = product.variants ?? [];
    const variantsWithPrice = sourceVariants.map(variant => ({ variant, price: number(variant.price) })).filter(row => row.price !== null);
    if (!variantsWithPrice.length) continue;
    const basePrice = Math.min(...variantsWithPrice.map(row => row.price));
    const compareValues = sourceVariants.map(variant => number(variant.compare_at_price)).filter(value => value !== null && value > basePrice);
    const compareAt = compareValues.length ? Math.max(...compareValues) : null;
    const memberNames = collectionCategoryNames(collections, membership, id);
    const category = chooseCategory(product, memberNames);
    categories.add(category);
    const bestSeller = bestSellerIds.has(id);
    const sourceOptions = (product.options ?? []).map(option => cleanText(option.name)).filter(Boolean);
    const variants = variantsWithPrice.map(({ variant, price }) => {
      const options = [variant.option1, variant.option2, variant.option3].filter(Boolean).map(cleanText);
      return {
        name: sourceOptions.join(' / ') || 'Opção',
        value: cleanText(options.length ? options.join(' / ') : (variant.title || 'Padrão')),
        priceExtra: Math.max(0, Math.round((price - basePrice) * 100) / 100),
        available: typeof variant.available === 'boolean' ? variant.available : null,
      };
    });
    const availabilityFlags = sourceVariants.map(variant => variant.available).filter(value => typeof value === 'boolean');
    const available = availabilityFlags.length ? availabilityFlags.some(Boolean) : null;
    const inventory = sourceVariants.map(variant => variant.inventory_quantity).filter(value => Number.isInteger(value) && value >= 0);
    const inventoryTotal = inventory.reduce((sum, value) => sum + value, 0);
    const stock = inventory.length
      ? (inventoryTotal > 0 ? inventoryTotal : available === true ? null : 0)
      : available === false ? 0 : null;
    demo.push({
      id,
      title: cleanText(product.title),
      slug: slugById.get(id),
      description: cleanText(product.body_html ?? ''),
      price: basePrice,
      compareAt,
      category,
      tags: normalizeTags(product, category, bestSeller),
      images: imagePathsById.get(id) ?? [],
      stock,
      available,
      rating: null,
      reviewCount: 0,
      reviews: [],
      variants,
    });
  }
  if (!demo.length) throw new Error('Nenhum produto válido para salvar; arquivos existentes foram preservados.');

  await fs.rm(OUT_IMAGES, { recursive: true, force: true });
  await fs.rename(STAGING, OUT_IMAGES);
  await fs.writeFile(OUT_DATA, `${JSON.stringify(demo, null, 2)}\n`, 'utf8');
  const report = {
    source: `${BASE}/collections/all`,
    syncedAt: new Date().toISOString(),
    sourceProducts: products.length,
    uniqueProducts: uniqueProducts.length,
    productsWritten: demo.length,
    categories: categories.size,
    allSourcePhotos: uniqueProducts.reduce((sum, product) => sum + (product.images?.length ?? 0), 0),
    uniqueSourcePhotos: imageJobs.length,
    localPreviewPhotos: imagesDownloaded,
    imageFailuresOrMissing: imagesFailed + productsWithoutPhotos,
    duplicatePhotoUrlsSkipped,
    productsWithoutPhotos,
    localWebpBytes: webpBytes,
    duplicateIdsSkipped: duplicateIds,
    completed: imagesFailed === 0 && productsWithoutPhotos === 0 && imagesDownloaded === imageJobs.length,
    note: 'A prévia mantém todas as fotos acessíveis em galerias WebP locais, sem hotlink. scripts/import-catalog.ts envia as mesmas fotos para o bucket Supabase produtos quando as credenciais estiverem configuradas.',
  };
  await fs.mkdir(path.resolve('docs'), { recursive: true });
  await fs.writeFile(path.resolve('docs/catalog-sync-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch(error => {
  console.error(`Sincronização local interrompida: ${error instanceof Error ? error.message : 'falha desconhecida'}`);
  process.exitCode = 1;
});
