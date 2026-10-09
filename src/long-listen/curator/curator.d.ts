import type { CuratorClient } from '../curation/api'

export type Send = (body: Record<string, unknown>) => Promise<Record<string, any>>

export declare const MODEL: string
export declare function modelFor(op: string): string
export declare function buildUserContent(op: string, payload: unknown): string
export declare function curatorBody(op: string, userContent: string): Record<string, unknown>
export declare function resourcesBody(userContent: string, priorTurns?: unknown[]): Record<string, unknown>
export declare function pingBody(): Record<string, unknown>
export declare function looksLikeAnthropicKey(key: string): boolean
export declare function anthropicSender(apiKey: string, fetchImpl?: typeof fetch): Send
export declare function directCurator(getKey: () => string, opts?: { fetchImpl?: typeof fetch; send?: Send; onUsage?: (op: string, model: string, usage: unknown) => void }): CuratorClient
export declare function promptVersions(): Record<string, string>
