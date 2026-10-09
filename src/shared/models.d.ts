export declare const MODEL_HAIKU: string
export declare const MODEL_SONNET: string
export declare const PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }>
export declare const WEB_SEARCH_PRICE: number
export declare function noThinking(model: string): Record<string, unknown>
