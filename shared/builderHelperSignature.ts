// Server-to-server only. The helper key never goes to a browser or build process.
export const helperSignatureHeader = "X-Kaizen-Helper-Signature";
export async function helperSignatureKey(secret: string) {
  if (!/^[a-f0-9]{64}$/.test(secret))
    throw new Error("Configure the helper billing key.");
  return crypto.subtle.importKey(
    "raw",
    Uint8Array.from(secret.match(/../g)!, (byte) => parseInt(byte, 16)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
const message = (input: Record<string, unknown>, token: string) =>
  new TextEncoder().encode(JSON.stringify(input) + "\n" + token);
export async function signHelperBilling(
  key: CryptoKey,
  input: Record<string, unknown>,
  token: string,
) {
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, message(input, token)),
  );
  return Array.from(signature, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
export async function verifyHelperBilling(
  key: CryptoKey,
  signature: string,
  input: Record<string, unknown>,
  token: string,
) {
  if (!/^[a-f0-9]{64}$/.test(signature)) return false;
  return crypto.subtle.verify(
    "HMAC",
    key,
    Uint8Array.from(signature.match(/../g)!, (byte) => parseInt(byte, 16)),
    message(input, token),
  );
}
