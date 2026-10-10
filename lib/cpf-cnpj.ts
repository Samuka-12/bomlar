export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function isValidCpfCnpj(value: string): boolean {
  const digits = digitsOnly(value);
  if (/^(\d)\1+$/.test(digits)) return false;

  if (digits.length === 11) {
    const first = cpfDigit(digits.slice(0, 9), 10);
    const second = cpfDigit(`${digits.slice(0, 9)}${first}`, 11);
    return digits === `${digits.slice(0, 9)}${first}${second}`;
  }

  if (digits.length === 14) {
    const first = cnpjDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    const second = cnpjDigit(`${digits.slice(0, 12)}${first}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    return digits === `${digits.slice(0, 12)}${first}${second}`;
  }

  return false;
}

function cpfDigit(base: string, initialWeight: number): number {
  const sum = [...base].reduce((total, digit, index) => total + Number(digit) * (initialWeight - index), 0);
  const remainder = (sum * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}

function cnpjDigit(base: string, weights: number[]): number {
  const sum = [...base].reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}
