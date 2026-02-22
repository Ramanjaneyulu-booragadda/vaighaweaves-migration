/**
 * Next.js Instrumentation — runs before server starts.
 *
 * Node.js 22+ (and 25 in particular) defines a partial global `localStorage`
 * as an empty plain object `{}` — without the Storage interface methods.
 * The Next.js dev overlay (and some Medusa SDK code) guards with
 *   `typeof localStorage !== 'undefined'`
 * which is TRUE in Node.js 22+, then immediately calls `.getItem()` which
 * throws "localStorage.getItem is not a function".
 *
 * This polyfill replaces the incomplete stub with a real in-memory
 * implementation so server-side code works correctly.
 */
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const isStorageIncomplete =
      typeof localStorage !== "undefined" &&
      typeof localStorage.getItem !== "function"

    if (isStorageIncomplete) {
      const store = new Map<string, string>()

      Object.defineProperty(globalThis, "localStorage", {
        value: {
          getItem: (key: string): string | null => store.get(key) ?? null,
          setItem: (key: string, value: string): void => {
            store.set(key, String(value))
          },
          removeItem: (key: string): void => {
            store.delete(key)
          },
          clear: (): void => {
            store.clear()
          },
          key: (index: number): string | null =>
            Array.from(store.keys())[index] ?? null,
          get length(): number {
            return store.size
          },
        } satisfies Storage,
        writable: true,
        configurable: true,
      })

      Object.defineProperty(globalThis, "sessionStorage", {
        value: {
          getItem: (_key: string): string | null => null,
          setItem: (_key: string, _value: string): void => {},
          removeItem: (_key: string): void => {},
          clear: (): void => {},
          key: (_index: number): string | null => null,
          length: 0,
        } satisfies Storage,
        writable: true,
        configurable: true,
      })
    }
  }
}
