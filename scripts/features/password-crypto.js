export const HASH_ITERATIONS = 600000;
export const toHex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
export const fromHex = (hex) => Uint8Array.from(hex.match(/.{2}/g) || [], (byte) => parseInt(byte, 16));

export async function hashPassword(password, salt, iterations = HASH_ITERATIONS) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return toHex(new Uint8Array(bits));
}

export async function createCredential(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: toHex(salt), hash: await hashPassword(password, salt), iterations: HASH_ITERATIONS };
}
