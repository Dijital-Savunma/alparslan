// Bloom filter for fast, memory-efficient domain lookups.
// ~700KB for 500K entries at 0.1% false positive rate.

/**
 * FNV-1a hash — fast, well-distributed, no crypto overhead.
 * Returns a 32-bit unsigned integer.
 */
function fnv1a(input: string, seed: number): number {
  let hash = 2166136261 ^ seed;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export interface BloomFilterData {
  bits: Uint32Array;
  numHashes: number;
  numBits: number;
}

/**
 * Calculate optimal Bloom filter parameters.
 * @param n — expected number of items
 * @param p — desired false positive rate (e.g. 0.001 = 0.1%)
 */
function optimalParams(n: number, p: number): { numBits: number; numHashes: number } {
  const numBits = Math.ceil((-n * Math.log(p)) / (Math.log(2) ** 2));
  const numHashes = Math.max(1, Math.round((numBits / n) * Math.log(2)));
  return { numBits, numHashes };
}

export function createBloomFilter(
  items: string[],
  falsePositiveRate = 0.001,
): BloomFilterData {
  const { numBits, numHashes } = optimalParams(items.length || 1, falsePositiveRate);
  const bits = new Uint32Array(Math.ceil(numBits / 32));

  for (const item of items) {
    const lower = item.toLowerCase();
    for (let i = 0; i < numHashes; i++) {
      const hash = fnv1a(lower, i) % numBits;
      bits[hash >>> 5] |= 1 << (hash & 31);
    }
  }

  return { bits, numHashes, numBits };
}

/**
 * Async version that yields to the event loop every CHUNK_SIZE items.
 * Prevents Firefox "extension not responding" during large list processing.
 */
export async function createBloomFilterAsync(
  items: string[],
  falsePositiveRate = 0.001,
): Promise<BloomFilterData> {
  const { numBits, numHashes } = optimalParams(items.length || 1, falsePositiveRate);
  const bits = new Uint32Array(Math.ceil(numBits / 32));
  const CHUNK_SIZE = 2000;

  for (let start = 0; start < items.length; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE, items.length);
    for (let idx = start; idx < end; idx++) {
      const lower = items[idx].toLowerCase();
      for (let i = 0; i < numHashes; i++) {
        const hash = fnv1a(lower, i) % numBits;
        bits[hash >>> 5] |= 1 << (hash & 31);
      }
    }
    if (end < items.length) {
      await new Promise<void>((r) => setTimeout(r, 0));
    }
  }

  return { bits, numHashes, numBits };
}

export function bloomFilterTest(filter: BloomFilterData, item: string): boolean {
  const lower = item.toLowerCase();
  for (let i = 0; i < filter.numHashes; i++) {
    const hash = fnv1a(lower, i) % filter.numBits;
    if ((filter.bits[hash >>> 5] & (1 << (hash & 31))) === 0) {
      return false; // definitely not in the set
    }
  }
  return true; // probably in the set
}

export function serializeBloomFilter(filter: BloomFilterData): ArrayBuffer {
  const header = new Uint32Array([filter.numBits, filter.numHashes]);
  const buffer = new ArrayBuffer(8 + filter.bits.byteLength);
  const view = new Uint8Array(buffer);
  view.set(new Uint8Array(header.buffer), 0);
  view.set(new Uint8Array(filter.bits.buffer), 8);
  return buffer;
}

export function deserializeBloomFilter(buffer: ArrayBuffer): BloomFilterData {
  const header = new Uint32Array(buffer, 0, 2);
  const numBits = header[0];
  const numHashes = header[1];
  const bits = new Uint32Array(buffer, 8);
  return { bits, numHashes, numBits };
}
