import PhoneNumber from 'awesome-phonenumber';

function cleanNumber(text = '') {
  return String(text).replace(/[^0-9]/g, '');
}

function toE164Digits(candidate = '') {
  try {
    const parsed = new PhoneNumber(candidate);
    if (!parsed.isValid()) return '';
    return cleanNumber(parsed.getNumber('e164'));
  } catch {
    return '';
  }
}

function normalizePairNumber(text = '') {
  const raw = String(text).trim();
  if (!raw) return '';

  const digits = cleanNumber(raw);
  if (!digits) return '';

  // 1) First pass: direct parse with explicit "+".
  const direct = toE164Digits(`+${digits}`);
  if (direct) return direct;

  // 2) Recovery pass: users often enter cc + local trunk "0" (e.g. 2340903...).
  // Try removing a single trunk zero after 1-3 digit country codes and re-validate.
  const recovered = new Set();
  for (let ccLen = 1; ccLen <= 3; ccLen += 1) {
    if (digits.length <= ccLen + 1) continue;
    const cc = digits.slice(0, ccLen);
    const trunk = digits.slice(ccLen, ccLen + 1);
    const rest = digits.slice(ccLen + 1);
    if (trunk !== '0') continue;

    const candidate = toE164Digits(`+${cc}${rest}`);
    if (candidate) recovered.add(candidate);
  }

  if (recovered.size === 1) return [...recovered][0];

  // 3) Last-resort fallback: accept clean international digits if they are
  // plausibly valid E.164 length. This prevents good numbers from being
  // rejected when metadata validation fails in some runtimes.
  if (digits.length >= 10 && digits.length <= 15) return digits;

  return '';
}

function parsePairNumbers(input = '') {
  const tokens = String(input)
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const valid = [];
  const invalid = [];

  for (const token of tokens) {
    const number = normalizePairNumber(token);
    if (!number) invalid.push(token);
    else valid.push(number);
  }

  return { valid: [...new Set(valid)], invalid };
}

export {
  cleanNumber,
  normalizePairNumber,
  parsePairNumbers
};
