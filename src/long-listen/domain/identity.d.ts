export interface WorkLike {
  composer: string
  title: string
  catalogue?: string
}

export interface RecordingLike {
  conductor?: string
  orchestra?: string
  ensemble?: string
  soloists: { name: string }[]
}

export declare function fold(s: string): string
export declare function workTitleKey(title: string): string
export declare function catalogueKey(catalogue?: string): string
export declare function artistId(kind: string, name: string): string
export declare function workId(composer: string, title: string): string
export declare function sameWork(a: WorkLike, b: WorkLike): boolean
export declare function performersKey(r: RecordingLike): string
export declare function recordingId(workIdValue: string, r: RecordingLike): string
export declare function creditLine(r: RecordingLike): string
export declare function surname(name: string): string
export declare function newId(prefix: string): string
