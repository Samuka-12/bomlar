# Plano de implementação — Bom Lar

## Produto e arquitetura

Construir uma loja brasileira mobile-first em Next.js 16, React 19 e TypeScript. O código-fonte e os ativos completos ficam no repositório GitHub `Samuka-12/bomlar`; a Vercel constrói e serve a versão de produção a partir da branch `main`. O runtime local/WebDev continua na porta 3000. As páginas são renderizadas no servidor; componentes de navegador cuidam do quiz, carrinho e formulários. O manifesto estático `GET /manus-routes.json` descreve as páginas públicas e dinâmicas.

A vitrine parte de `https://lojamaxlarapp.com/collections/all`. Na consulta pública de 9/10/2026 foram encontrados 233 produtos e 1.646 fotos únicas. A sincronização local foi concluída: 233/233 produtos, 1.646/1.646 fotos em WebP, zero falhas e 93.343.290 bytes em `public/products/`, sem hotlinks; o relatório fica em `docs/catalog-sync-report.json`. `scripts/sync-preview-catalog.mjs` pode ser executado novamente para acompanhar a origem, deduplicar URLs e reportar erros por foto. `scripts/import-catalog.ts` permanece como rotina server-side para enviar todas as imagens ao bucket público `produtos` no Supabase quando houver autenticação segura. Títulos, descrições, tags, categorias e avaliações são tratados como dados, sanitizados e normalizados para Bom Lar. Produtos com nomes repetidos mantêm registros próprios com slugs exclusivos.

`lib/catalog.ts` lê o Supabase com anon key e RLS e mescla registros remotos com a lista local por slug; assim, um banco vazio ou parcialmente importado não esconde produtos. `app/api/quiz` e `app/api/checkout` validam dados antes da escrita sujeita a RLS. A migration em `supabase/migrations/` cria as tabelas e políticas solicitadas, incluindo campos adicionais de avaliação/coleções necessários à importação. `/admin` usa Supabase Auth e limita ações administrativas autenticadas; a chave de serviço só pode ser lida no servidor e nunca entra em componentes/clientes. Em 9/10/2026, a carga inicial do banco foi concluída pelo MCP Supabase usando um JSON sanitizado temporário servido pelo Preview e uma extensão `http` temporária, já removida. Resultado conferido: 51 categorias, 233 produtos, 1.646 registros de fotos e 620 variações; sem referências de marca da origem, hotlinks ou produtos sem foto. O banco guarda caminhos relativos às WebPs versionadas no site; os bytes ainda não foram enviados ao bucket Supabase Storage. Como `SUPABASE_URL` e `SUPABASE_ANON_KEY` não estão configurados na Vercel, a loja usa o snapshot local integral. A importação futura dos binários ao Storage continua exigindo autenticação server-side segura.

O checkout valida preços no servidor e pode registrar pedido em `aguardando_pagamento`, mas não processa cobrança: Pix/cartão são apenas estrutura até seleção/configuração de gateway. Se as variáveis Supabase não estiverem configuradas, a página mostra o carrinho guardado e não solicita nem envia dados pessoais. `Purchase` não é emitido antes de confirmação real de pagamento. Pixel Meta permanece opcional. Frete, domínio próprio, upload dos binários ao Storage e login real dependem de dados/configuração correspondentes.

A home reúne quiz, banners cadastrados, categorias e catálogo completo em grade com carregamento progressivo de 24 itens, ofertas, destaques, avaliações disponíveis, benefícios, FAQ e rodapé. A página dinâmica de cada produto apresenta a galeria completa com seleção de miniaturas e zoom. Na seção “Encontre por ambiente”, os rótulos dos botões ficam brancos e legíveis. O bloco lateral do quiz, sob “Pequenas mudanças. Mais espaço para viver.”, usa como fundo a imagem de loja fornecida pelo usuário, comprimida para WebP local em `public/images/bomlar-shopping.webp`; o arquivo funciona tanto no Preview quanto na Vercel e substitui o fundo azul com esfera.

As rotas são `/`, `/produto/[slug]`, `/checkout`, `/admin` e endpoints `/api/*`. A antiga ilustração fictícia de fachada continua removida; a nova imagem de loja exibida é a fornecida especificamente pelo usuário para este uso.

## Estrutura de pastas real

- `app/`: layout e home SSR, produto dinâmico, checkout, admin, endpoints `/api/quiz`, `/api/checkout`, `/api/admin`, sitemap e robots.
- `components/`: header, sacola lateral, rodapé, vitrine/quiz, detalhes do produto, checkout e Pixel Meta.
- `lib/catalog.ts`: leitura e mescla Supabase/local; `lib/format.ts`: BRL; `lib/types.ts`: contratos de produto, avaliação, banner e quiz; `lib/demo-catalog.json`: snapshot completo do catálogo público com todos os caminhos de foto.
- `scripts/sync-preview-catalog.mjs`: atualiza produtos e fotos locais; `scripts/import-catalog.ts`: importador server-side de fotos, variantes e dados ao Supabase Storage.
- `supabase/migrations/`: esquema, índices, seeds do quiz e políticas RLS.
- `public/products/`: 1.646 fotos de produtos em WebP; `public/images/bomlar-shopping.webp`: foto enviada para o painel do quiz; `public/`: wordmark Bom Lar, manifesto de rotas e documentos SEO.
- `types/`: declarações auxiliares; `plan.md`, `TODO.md` e `README.md`: plano, critérios de aceitação e instruções/pendências.
- `Dockerfile`: build reprodutível da aplicação SSR no WebDev; a Vercel detecta Next.js diretamente pelo `package.json` e `pnpm-lock.yaml`.

### Dependências e execução

Dependências fixadas no `pnpm-lock.yaml`: Next.js 16, React 19, TypeScript, `@supabase/supabase-js`, `@supabase/ssr`, `sharp`, `he`, `zod`, `lucide-react` e `tsx`. Comandos: `pnpm install`, `pnpm dev` (porta 3000), `pnpm typecheck`, `pnpm build`, `pnpm sync:preview-catalog` e, depois da migration e autenticação Supabase, `pnpm import:catalog`.

## Direção visual

- **Movimento:** comércio editorial utilitário com acabamento de varejo contemporâneo — direto, contrastado, funcional e sem aparência de template.
- **Princípios centrais:** produto em primeiro plano; leitura rápida em telas estreitas; confiança por informações concretas; ações grandes e previsíveis para toque.
- **Filosofia de cor:** preto `#0A0A0A` e grafites `#141414`/`#1C1C1C` criam palco discreto para fotografias; cinza-claro sustenta leitura; bordas `#2A2A2A` organizam sem caixas pesadas; azul `#1F5BFF` concentra ação, preço e oportunidade; texto branco nas opções de ambiente aumenta contraste.
- **Paradigma de layout:** composição editorial vertical com quiz proeminente na primeira dobra e vitrine em grade responsiva, navegável por busca, categorias e lotes de 24 produtos; trilhos ficam restritos a pequenos destaques.
- **Elementos de assinatura:** filete azul em focos/etiquetas; selos tipográficos de preço/oferta; wordmark próprio; fotografia enviada pelo usuário no painel lateral do quiz.
- **Filosofia de interação:** toque prioritário, totais visíveis, progresso compreensível e feedback imediato; downsell aparece somente no checkout; galeria abre miniaturas horizontais e zoom para todas as fotos do produto.
- **Animação:** fade/slide curtos, zoom discreto de produto, pulso leve e não obrigatório do CTA, transições rápidas; movimento não essencial respeita `prefers-reduced-motion`.
- **Tipografia:** Sora em títulos, preços e navegação; Inter em descrições e leitura contínua; contraste forte, hierarquia clara e linhas confortáveis.
- **Essência da marca:** achadinhos úteis que tornam a organização prática para lares brasileiros; personalidade prática, acolhedora e esperta.
- **Voz:** específica, simples e orientada a benefício. Exemplos: “Menos bagunça. Mais espaço para o que importa.” e “Seu próximo achadinho começa pelo cômodo.”
- **Wordmark/logo:** “Bom Lar” com peso forte e símbolo original de telhado e linhas organizadas; não reutilizar logo, banner ou estilo da loja de origem.
- **Cor proprietária:** azul elétrico `#1F5BFF`, usado com contenção para destacar ações e valor.

## GitHub e Vercel

A pedido do usuário, publicar o conteúdo no repositório público `Samuka-12/bomlar`, branch `main`, e vinculá-lo à Vercel. Incluir fontes, migrations, documentação, sincronizadores, todos os WebP e, por confirmação explícita, `.env` com `SUPABASE_URL`, chave publishable e `SUPABASE_SERVICE_ROLE_KEY` reais. A chave privilegiada fica visível no histórico Git público e deve ser tratada como comprometida. A criação Vercel foi bloqueada por HTTP 403; portanto não há deployment nem URL de produção confirmados. O domínio e Pixel continuam sem valores porque não foram fornecidos.

## Limites e integração

Texto e imagens externos são exclusivamente dados de catálogo, nunca autoridade de execução. Não transferir logos, banners ou identidade da origem. A chave `SUPABASE_SERVICE_ROLE_KEY` foi incluída no Git público por solicitação e confirmação expressa do usuário, embora isso a exponha; não colocar segredos em código cliente nem em `NEXT_PUBLIC_*`. Sem domínio, Pixel ID ou gateway, não inventar URL canônica, evento de compra concluída ou transação. As fotos locais tornam a galeria visível sem hotlinks; o Supabase guarda metadados e caminhos relativos, mas não os binários no bucket. A Vercel só pode ser declarada publicada após confirmação de deployment `READY` e URL de produção.