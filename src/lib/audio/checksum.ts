/**
 * Computes a SHA-256 checksum for an audio blob.
 * Used for end-to-end data integrity verification.
 */
export async function computeChecksum(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  
  // Use the native Web Crypto API
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  
  // Convert ArrayBuffer to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}
