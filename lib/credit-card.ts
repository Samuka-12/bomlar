export type CreditCardPaymentInput = {
  orderId: string;
  amountCents: number;
  installments: number;
  card: {
    number: string;
    holderName: string;
    expirationMonth: string;
    expirationYear: string;
    cvv: string;
  };
  customer: {
    name: string;
    email: string;
    phone: string;
    document: string;
  };
};

export type CreditCardPaymentResult = {
  success: boolean;
  transactionId?: string;
  status: 'aprovado' | 'em_analise' | 'recusado';
  message: string;
};

/**
 * Função modular para processar pagamentos via Cartão de Crédito.
 * Preparada para receber a integração com a API de crédito do usuário.
 */
export async function processCreditCardPayment(
  data: CreditCardPaymentInput,
): Promise<CreditCardPaymentResult> {
  // Ponto de entrada para a API de crédito que será fornecida pelo usuário
  return {
    success: true,
    transactionId: `CC-${Date.now()}`,
    status: 'aprovado',
    message: 'Pagamento via Cartão de Crédito aprovado com sucesso!',
  };
}
