export type CueVolume = 'soft' | 'normal' | 'loud'
export declare function cueSet(kind: string, volume?: CueVolume): { transition: () => void; complete: () => void }
export declare function playTick(volume?: CueVolume): void
export declare function playChime(volume?: CueVolume, variant?: 'sitwalk' | 'custom'): void
export declare function primeAudio(): void
