export interface CharRecord {
  /** Microsoft Wubi codes */
  codes: DictCode[]
  py?: string
  ids?: string
  rad?: string
  /** stroke type sequence: 1横 2竖 3撇 4点 5折 */
  ss?: string
  /** 98 full code from decomposition data */
  full?: string
  /** 0 normal, 1 key-name root, 2 character root, 3 single stroke */
  t?: number
  /** root glyph ids (hex PUA codepoints) */
  r?: string[]
  /** identification-code glyph id */
  idu?: string
  /** e.g. 横·左右〔一 ⿰〕 */
  flag?: string
  more?: string
  /** stroke SVG paths (hanzi-writer coordinates) */
  s?: string[]
  /** stroke indices per root */
  seg?: number[][]
  q?: 'source' | 'exact' | 'approx'
}

/** [code, 1-based candidate rank, number of candidates under the code] */
export type DictCode = [string, number, number]

export interface RootInfo {
  k: string
  p: string
  n: string
  /** descriptive alias for non-character roots, e.g. 青字头 */
  a?: string
  id: number
}

export interface Meta {
  entries: number
  codes: number
  words: number
  chars: number
  decomposed: number
  strokes: number
}

// Bump when the data format changes so cached shards from older builds are not reused.
const DATA_VERSION = 6
const cache = new Map<string, Promise<unknown>>()

function fetchJson<T>(path: string): Promise<T> {
  let p = cache.get(path)
  if (!p) {
    p = fetch(`/data/${path}?v=${DATA_VERSION}`).then((r) => {
      // Missing shards fall back to index.html (SPA routing) on both Vite and Cloudflare Pages.
      if (r.status === 404 || !r.headers.get('content-type')?.includes('json')) return {}
      if (!r.ok) throw new Error(`${r.status} ${path}`)
      return r.json()
    })
    p.catch(() => cache.delete(path))
    cache.set(path, p)
  }
  return p as Promise<T>
}

const cp = (s: string) => s.codePointAt(0)!

export async function getChar(ch: string): Promise<CharRecord | null> {
  const shard = await fetchJson<Record<string, CharRecord>>(`c/${(cp(ch) >> 4).toString(16)}.json`)
  return shard[ch] ?? null
}

export async function getWordCodes(word: string): Promise<DictCode[]> {
  const shard = await fetchJson<Record<string, DictCode[]>>(`w/${(cp(word) >> 6).toString(16)}.json`)
  return shard[word] ?? []
}

/** All codes starting with the first two letters of `code`, with their candidates in system order. */
export function getCodeShard(code: string): Promise<Record<string, string[]>> {
  return fetchJson(`k/${code.slice(0, 2)}.json`)
}

export const getRoots = () => fetchJson<Record<string, RootInfo>>('roots.json')
export const getMeta = () => fetchJson<Meta>('meta.json')
