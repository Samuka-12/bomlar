# Integração Pix IronPay

## Fontes e contrato utilizado

A integração segue a [documentação oficial da API IronPay](https://docs.ironpayapp.com.br/) e sua referência de [transações](https://docs.ironpayapp.com.br/transactions). O endpoint informado pelo proprietário é `https://api.ironpayapp.com.br/api/public/v1`.

A documentação especifica `POST /transactions` com `api_token` via query string, `amount` em centavos, `offer_hash`, `payment_method: "pix"`, `installments`, dados obrigatórios do cliente (`name`, `email`, `phone_number` e `document`) e `cart`. Cada linha do carrinho inclui `product_hash`, `title`, `price` em centavos, `quantity`, `operation_type` e `tangible`. `postback_url` é opcional.

A resposta documentada contém `hash`, `payment_status`, `amount` e `pix.pix_qr_code`; `pix.pix_url` pode ser nulo. A aplicação usa a string `pix.pix_qr_code` para montar um QR SVG local e disponibilizar o mesmo conteúdo como copia-e-cola. Antes de aceitar esse conteúdo em produção, a resposta deve ser validada com uma cobrança real autorizada, pois nenhum request transacional foi feito durante esta implementação.

A consulta documentada usa `GET /transactions/{hash}` com autenticação por `api_token` na query e devolve `hash`, `status` e `amount`. A aplicação compara hash e total, consulta a API antes de aceitar um postback e atualiza `pedidos` somente depois dessa confirmação.

## Valores e segredo

Os hashes de oferta/produto informados pelo proprietário são `IRONPAY_OFFER_HASH` e `IRONPAY_PRODUCT_HASH`; os campos possuem defaults em `.env.example` e podem ser ajustados por variável de ambiente. O total e os preços unitários vêm do catálogo Supabase e são recalculados no servidor para cada checkout.

`IRONPAY_API_TOKEN` precisa ser configurada como variável privada server-side. Ela não está em arquivo, no repositório, nos componentes do navegador ou no runtime atual. Por isso, a API de checkout responde com estado de configuração e não cria cobrança. Nenhum token foi usado em request de rede e nenhum Pix de teste foi emitido.

## Fluxo implementado

1. O checkout coleta nome, telefone, e-mail, CPF/CNPJ e endereço; a validação local impede documento inválido.
2. O servidor verifica o catálogo Supabase, disponibilidade, variações, estoque e downsell; recalcula o total em centavos.
3. Um pedido idempotente e um registro privado `pagamentos_pix` são criados antes da chamada IronPay.
4. IronPay recebe um POST por pedido com o valor total e as linhas do carrinho. A resposta é guardada no registro privado.
5. O cliente mostra QR SVG, texto copia-e-cola, expiração quando disponível e consulta o status a cada oito segundos.
6. O webhook não é tratado como prova: o servidor consulta a IronPay novamente e verifica o hash e o valor antes de atualizar o pedido.

A tabela `public.pagamentos_pix` tem RLS habilitado, sem políticas públicas e sem grants para `anon` ou `authenticated`; o acesso é apenas server-side. A tabela guarda o hash da transação e o estado operacional, não o token.

## Pendências de ativação

- `IRONPAY_API_TOKEN` ainda não está disponível no ambiente server-side. O usuário optou por não usar a entrada protegida durante esta sessão; não substituir isso por um token hardcoded ou commit público.
- Não foi possível confirmar que os hashes de oferta/produto aceitam o preço e os títulos dinâmicos do catálogo; o mapeamento precisa ser validado junto à IronPay antes de transações reais.
- Sem token disponível, o formato de `pix.pix_qr_code`, o postback e a consulta de estados só foram verificados contra o exemplo da documentação, não por uma chamada ao merchant.
- A Vercel ainda não tem projeto/deployment associado; sua criação anterior retornou HTTP 403.
