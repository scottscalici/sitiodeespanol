// Obfuscates the daily Señordle answer so it isn't sitting in plain text in
// the Firestore document (readable straight off the Network tab, or via a
// direct query any logged-in student's own session could run) or as a
// plainly-named React prop in DevTools. This is NOT real security — the key
// below ships in the same JS bundle as everything else, so a student
// determined enough to read the app's source could still find it — but it
// raises the bar well past "glance at the network tab" or "open React
// DevTools," which is the realistic risk for a classroom game like this.
const CIPHER_KEY = 'SITIODEESPANOL';

const xorWithKey = (str) =>
  str
    .split('')
    .map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ CIPHER_KEY.charCodeAt(i % CIPHER_KEY.length)))
    .join('');

export const encodeWord = (word) => btoa(xorWithKey(word.toUpperCase()));

// Tolerates legacy plaintext words saved before this scheme existed — a
// real encoded value only ever decodes to 5 letters (A-Z or Ñ); anything
// else (or a string atob can't even parse, which is the common case for a
// 5-letter plaintext word) falls back to using the original value as-is.
export const decodeWord = (value) => {
  if (!value) return value;
  try {
    const decoded = xorWithKey(atob(value));
    if (/^[A-ZÑ]{5}$/.test(decoded)) return decoded;
  } catch (err) {
    // Not valid base64 — definitely legacy plaintext, fall through.
  }
  return value.toUpperCase();
};
