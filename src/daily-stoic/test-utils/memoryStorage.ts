// Node's own experimental `localStorage` global shadows happy-dom's implementation
// and reads as undefined without a --localstorage-file flag. Call this once per test
// file (e.g. at module scope) to replace it with a minimal in-memory Storage so
// components reading/writing localStorage (useInsightPeriod, useShowGuides, etc.)
// don't crash under `// @vitest-environment happy-dom`.
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }
  get length() {
    return this.store.size;
  }
}

export function installMemoryStorage() {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
}
