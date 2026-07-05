/**
 * Normalize an Indian mobile number to WhatsApp Cloud API format (digits only, with country code, no +).
 * Returns null when the number is invalid.
 */
function normalizeWhatsAppNumber(raw) {
  if (!raw) return null;

  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;

  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `91${digits}`;
  }

  if (
    digits.length === 12 &&
    digits.startsWith("91") &&
    /^91[6-9]/.test(digits)
  ) {
    return digits;
  }

  if (digits.length === 11 && digits.startsWith("0")) {
    const local = digits.slice(1);
    if (local.length === 10 && /^[6-9]/.test(local)) {
      return `91${local}`;
    }
  }

  return null;
}

module.exports = {
  normalizeWhatsAppNumber,
};
