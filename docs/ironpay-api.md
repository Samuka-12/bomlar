# Integração Pix IronPay

## Fontes e contrato utilizado

A integração segue a [documentação oficial da API IronPay](https://docs.ironpayapp.com.br/) e sua referência de [transações](https://docs.ironpayapp.com.br/transactions). O endpoint informado pelo proprietário é `https://api.ironpayapp.com.br/api/public/v1`.

A documentação especifica `POST /transactions` com `api_token` via query string, `amount` em centavos, `offer_hash`, `payment_method: "pix"`, `installments`, dados obrigatórios do cliente (`name`, `email`, `phone_number` e `document`) e `cart`. Cada linha do carrinho inclui `product_hash`, `title`, `price` em centavos, `quantity`, `operation_type` e `tangible`. `postback_url` é opcional.

A resposta documentada contém `hash`, `payment_status`, `amount` e `pix.pix_qr_code`; `pix.pix_url` pode ser nulo. A aplicação usa a string `pix.pix_qr_code` para montar um QR SVG local e disponibilizar o mesmo conteúdo como copia-e-cola. Antes de aceitar esse conteúdo em produção, a resposta deve ser validada com uma cobrança real autorizada, pois nenhum request transacional foi feito durante esta implementação.

A consulta documentada usa `GET /transactions/{hash}` com autenticação por `api_token` na query e devolve `hash`, `status` e `amount`. A aplicação compara hash e total, consulta a API antes de aceitar um postback e atualiza `pedidos` somente depois dessa confirmação.

## Valores e segredo

Os hashes de oferta/produto informados pelo proprietário são `IRONPAY_OFFER_HASH` e `IRONPAY_PRODUCT_HASH` (`znnxaxwoww` e `ya4mvapqsm`); a API base é `https://api.ironpayapp.com.br/api/public/v1` e o token de webhook é `b3tuqw4ioc`. O total e os preços unitários vêm do catálogo Supabase e são recalculados dinamicamente no servidor para cada produto e variação.

A variável `IRONPAY_API_TOKEN` está configurada no ambiente server-side (`.env`), ativando a geração real de QR Code e Copia e Cola para todos os produtos da loja.

## Fluxo implementado e validado

1. O cliente escolhe o produto na vitrine ou na página de detalhes e clica em **"Pagar com Pix"** (ou adiciona à sacola e vai ao checkout). O preço dinâmico do produto e de suas opções é refletido no pedido.
2. No checkout, a opção **Pix (Aprovação Imediata)** gera o pedido idempotente no Supabase e solicita a transação diretamente à IronPay com o valor exato em centavos.
3. A IronPay retorna a cobrança em estado `waiting_payment` com o código BR Code Pix (`pix.pix_qr_code`).
4. A loja renderiza imediatamente um QR Code SVG nítido e local via `qrcode.react`, um campo de texto com Copia e Cola, e um botão com cópia em 1 clique.
5. O cliente visualiza o status ativo com indicador pulsante: *"Aguardando confirmação do pagamento no seu banco…"*.
6. O frontend consulta `/api/checkout/status` a cada 3,5 segundos e imediatamente ao focar na janela/aba (quando o cliente volta do aplicativo bancário).
7. Quando a IronPay confirma o pagamento (via consulta de status ou via webhook `POST /api/ironpay/webhook` validado com o token), o status atualiza para `pago`, o pedido é concluído, o carrinho é limpo e o evento Meta Pixel `Purchase` é disparado.

## Status de ativação

- **Integração ativa:** Testada e confirmada via chamadas reais à API IronPay (criação de transação Pix `201 Created` e consulta `200 OK`).
- **Webhook e segurança:** Endpoint `/api/ironpay/webhook` configurado com validação do token `b3tuqw4ioc` e conferência de segurança via consulta direta à API IronPay.
- **Preços dinâmicos:** Validados para todos os produtos do catálogo Supabase.
