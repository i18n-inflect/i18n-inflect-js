/**
 * A minimal least-recently-used cache built on `Map`'s insertion order.
 *
 * Used for two hot paths: memoized template parsing and the shared
 * inflection "oracle" cache that lets asynchronous neural answers upgrade
 * later synchronous calls.
 */
export class LruCache<K, V> {
  private readonly map = new Map<K, V>();

  constructor(private readonly capacity: number) {
    if (capacity < 1) throw new RangeError("LruCache capacity must be >= 1");
  }

  /** Number of entries currently stored. */
  get size(): number {
    return this.map.size;
  }

  /** Read a value and refresh its recency. */
  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value === undefined && !this.map.has(key)) return undefined;
    // Re-insert to move the key to the "most recently used" end.
    this.map.delete(key);
    this.map.set(key, value as V);
    return value;
  }

  /** Store a value, evicting the least recently used entry when full. */
  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.capacity) {
      const oldest = this.map.keys().next();
      if (!oldest.done) this.map.delete(oldest.value);
    }
    this.map.set(key, value);
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  clear(): void {
    this.map.clear();
  }
}
