ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS total_centavos bigint;

COMMENT ON COLUMN public.pedidos.total_centavos IS
  'Total autoritativo do pedido em centavos, calculado no servidor para o checkout Pix.';
