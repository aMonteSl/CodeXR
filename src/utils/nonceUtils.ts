import * as crypto from 'crypto';

/**
 * Generates a cryptographically secure nonce string for CSP
 * @returns A random string to use as nonce
 */
export function generateNonce(): string {
  // Generate 8 bytes of random data (64 bits)
  const buffer = crypto.randomBytes(8);
  // Convert to hex string for more efficient representation
  return buffer.toString('hex');
}

if (require.main === module) {
  console.log(generateNonce());
}
