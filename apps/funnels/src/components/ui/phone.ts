import { COUNTRIES, type Country } from "./phoneCountries";

export const DEFAULT_PHONE_COUNTRY = COUNTRIES[0]!;

export function stripPhoneToDigits(raw: string, maxLength: number): string {
  return raw.replace(/\D/gu, "").slice(0, maxLength);
}

export function formatPhoneNumber(digits: string, country: Country): string {
  if (!digits) return "";
  if (country.code === "+1" && country.maxDigits === 10) {
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    }
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return digits.replace(/(\d{3})(?=\d)/gu, "$1 ").trim();
}

export function isValidPhoneNumber(raw: string, country: Country): boolean {
  const digits = raw.replace(/\D/gu, "");
  return (
    digits.length >= country.minDigits && digits.length <= country.maxDigits
  );
}
