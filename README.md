# Bom Lar — achadinhos para casa

Loja mobile-first em Next.js 16, React 19 e TypeScript, em português do Brasil. A vitrine usa o catálogo público completo de `https://lojamaxlarapp.com/collections/all`. Sincronização local concluída em 9/10/2026: **233 produtos, 1.646/1.646 fotos WebP, zero falhas**, servidas sem hotlink; as galerias e páginas de produto contêm todas as fotos. O relatório está em `docs/catalog-sync-report.json`. A grade principal apresenta itens em lotes de 24, enquanto busca e filtros percorrem a lista inteira. A imagem de loja enviada pelo usuário, em `public/images/bomlar-shopping.webp`, substitui o fundo azul/esfera do painel do quiz; “Encontre por ambiente” usa texto branco.

## Execução

- `pnpm install`
- `pnpm dev` (porta 3000)
- `pnpm typecheck`
- `pnpm build`
- `pnpm start` (honra `PORT`, padrão 3000)
- `pnpm sync:preview-catalog` para atualizar todos os produtos e baixar todas as fotos disponíveis de cada item.
- `pnpm import:catalog` para importar no servidor todas as imagens, variantes, categorias, avaliações e produtos ao Supabase Storage/banco.
- O WebDev usa o `Dockerfile` da raiz. A Vercel detecta Next.js pelo `package.json` e `pnpm-lock.yaml`; usar `pnpm install --frozen-lockfile` e `pnpm build`.

## GitHub e Vercel

O repositório fonte é `https://github.com/Samuka-12/bomlar`, branch `main`. Os ativos locais `public/products/` e `public/images/bomlar-shopping.webp` são necessários para o catálogo completo e para o fundo do quiz. Por solicitação explícita do proprietário, o branch público também contém `.env` com as variáveis Supabase; `SUPABASE_SERVICE_ROLE_KEY` fica assim publicamente acessível e deve ser tratada como comprometida. `node_modules/` e `.next/` não são enviados. ` .env.example` continua disponível com placeholders.

## Variáveis protegidas

`SUPABASE_URL` e `SUPABASE_ANON_KEY` atendem consultas públicas/SSR sujeitas a RLS. `SUPABASE_SERVICE_ROLE_KEY` é privilegiada e ignora RLS; por solicitação explícita, seu valor real está no `.env` do repositório público. O valor é legível por qualquer pessoa e deve ser rotacionado antes de uso seguro em produção. Nunca referencie essa chave em `NEXT_PUBLIC_*` nem no código de navegador. O token IronPay é lido apenas de `IRONPAY_API_TOKEN` no runtime do servidor e nunca deve ser adicionado ao Git. `IRONPAY_OFFER_HASH` e `IRONPAY_PRODUCT_HASH` identificam a oferta e o produto configurados. Como o usuário optou por não usar entrada protegida e nenhuma variável do token está disponível no runtime, o checkout Pix fica desativado e nenhuma cobrança é enviada. O Pixel e o domínio público seguem sem valores; o projeto Vercel ainda não foi criado (HTTP 403).

Implementação alinhada à [documentação oficial da API IronPay](https://docs.ironpayapp.com.br/): `POST /transactions` recebe `amount` em centavos, `offer_hash`, `payment_method: pix`, dados do cliente e itens do carrinho; o campo `pix.pix_qr_code` abastece o copia-e-cola e o QR SVG. `GET /transactions/{hash}` verifica estado e valor; postbacks só atualizam o pedido após nova verificação na API.

## Banco, catálogo e limites

A migration em `supabase/migrations/` cria o esquema e as políticas RLS. `scripts/sync-preview-catalog.mjs` consulta a coleção pública `/collections/all`, limpa texto como dado, substitui a marca de origem, gera slugs distintos, baixa cada imagem acessível em WebP, atualiza a galeria de cada produto e grava um relatório em `docs/catalog-sync-report.json`. Em 9/10/2026, a carga inicial do banco Supabase `bomlar` foi confirmada: 51 categorias, 233 produtos, 1.646 linhas de imagens e 620 variações; não há fotos remotas nem produtos sem foto. O banco guarda caminhos relativos (`/products/...`), e os binários permanecem no site. O bucket público `produtos` ainda não recebeu os arquivos; `scripts/import-catalog.ts` precisa de autenticação server-side segura para completar essa transferência. A extensão HTTP e o JSON temporário usados na carga foram removidos após a confirmação.

A Vercel ainda não tem projeto/deployment: a criação foi negada com HTTP 403. A interface existente usa o snapshot local até que as variáveis sejam carregadas no runtime de produção; o `.env` público do repositório não equivale a uma configuração secreta de plataforma. O checkout Pix só solicita dados e envia uma cobrança à IronPay quando Supabase, chave de serviço e `IRONPAY_API_TOKEN` estão disponíveis no servidor; sem isso mostra o resumo sem solicitar dados pessoais. A implementação do QR, copia-e-cola e consulta de status está no código, mas não foi possível ativar nem validar chamadas reais da IronPay porque o token não foi salvo em configuração protegida. `Purchase` só pode ser enviado após confirmação real de pagamento. O painel autenticado e o upload dos binários ao Supabase Storage ainda dependem de configuração segura.

## Fluxo Pix IronPay

A arquitetura, os campos da API, a tabela privada, o acompanhamento de status e as pendências de ativação estão em [`docs/ironpay-api.md`](docs/ironpay-api.md). O token não está salvo no repositório e o checkout não cria cobranças enquanto ele não estiver disponível como segredo server-side.
