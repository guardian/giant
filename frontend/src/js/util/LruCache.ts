type OnMissFunction<K, V> = (k: K) => V;
type OnEvictFunction<K, V> = (k: K, v: V) => void;

export class LruCache<K extends string | number, V> {
  // We keep track of value recency using a queue data structure.
  //
  // Here's an tutorial on how a LRU cache can be implemented with queues:
  //   https://www.interviewcake.com/concept/java/lru-cache
  //
  // The tutorial uses a linked list which has certain performance characteristics which
  // can be ignored for this implementation since we're using whatever data structure
  // the browser uses for lists (e.g. https://github.com/v8/v8/blob/d5625e3/src/objects/js-array.h#L20-L24)

  maxEntries: number;
  recencyQueue: K[] = [];
  entries: Record<K, V> = {} as Record<K, V>;

  // This function tells the LRU cache how to fetch a new value
  onMiss: OnMissFunction<K, V>;

  // This function tells the LRU cache what to do when it evicts an item
  onEvict: OnEvictFunction<K, V>;

  constructor(
    maxEntries: number,
    onMiss: OnMissFunction<K, V>,
    onEvict: OnEvictFunction<K, V> = () => {}
  ) {
    this.maxEntries = maxEntries;
    this.onMiss = onMiss;
    this.onEvict = onEvict;
  }

  private evict = (key: K, value: V) => {
    this.onEvict(key, value);
    const index = this.recencyQueue.findIndex((k) => k === key);
    this.recencyQueue.splice(index, 1);
    delete this.entries[key];
  };

  private addToCache = (key: K, value: V) => {
    this.entries[key] = value;
    this.recencyQueue.push(key);

    if (this.recencyQueue.length > this.maxEntries) {
      const evictedEntryKey = this.recencyQueue.shift();
      if (evictedEntryKey) {
        const evictedEntry = this.entries[evictedEntryKey];
        this.onEvict(evictedEntryKey, evictedEntry);
        delete this.entries[evictedEntryKey];
      }
    }
  };

  private bumpRecency = (key: K) => {
    const index = this.recencyQueue.findIndex((k) => k === key);
    this.recencyQueue.splice(index, 1);
    this.recencyQueue.push(key);
  };

  keys = () => this.recencyQueue;

  get = (k: K): V => {
    if (this.entries[k]) {
      this.bumpRecency(k);
      return this.entries[k];
    } else {
      const newValue = this.onMiss(k);
      this.addToCache(k, newValue);
      return newValue;
    }
  };

  getAndForceRefresh = (k: K): V => {
    const oldValue = this.entries[k];
    const newValue = this.onMiss(k);

    if (oldValue) {
      this.evict(k, oldValue);
    }

    this.addToCache(k, newValue);

    return newValue;
  };
}
