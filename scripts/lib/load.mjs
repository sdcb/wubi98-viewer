import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { parseSegments } from './segment.mjs'

export const SRC = 'data-src'

export function loadWubi() {
  const lines = readFileSync(join(SRC, 'data-wubi-v98.tsv'), 'utf8').split('\n').filter((l) => l.trim()).slice(1)
  const map = new Map()
  for (const l of lines) {
    const f = l.replace(/\r$/, '').split('\t')
    const units = [...f[7].replace(/[〖〗]/g, '')].join('').split('※').filter(Boolean)
    map.set(f[0], {
      char: f[0],
      code: f[1],
      short: f[2] ? f[2].split('/') : [],
      more: f[3],
      keyUnit: f[4] === '1',
      strokeUnit: f[5] === '1',
      charUnit: f[6] === '1',
      units,
      flag: f[8],
      segments: /\d/.test(f[9] ?? '') ? parseSegments(f[9]) : null,
      interleaved: (f[9] ?? '').startsWith('*'),
    })
  }
  return map
}

export function loadChars() {
  const lines = readFileSync(join(SRC, 'data-chars.tsv'), 'utf8').split('\n').filter((l) => l.trim()).slice(1)
  const map = new Map()
  for (const l of lines) {
    const f = l.replace(/\r$/, '').split('\t')
    map.set(f[1], {
      ids: f[7],
      pinyin: f[8],
      radical: f[9],
      strokes: Number(f[10]),
      strokeSeq: f[11],
      freq: Number(f[12]) || 0,
    })
  }
  return map
}

const hwCache = new Map()
export function loadHanziWriter(ch) {
  if (hwCache.has(ch)) return hwCache.get(ch)
  const p = join(SRC, 'hanzi-writer-data', `${ch}.json`)
  const v = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null
  hwCache.set(ch, v)
  return v
}

export function loadMs() {
  const lines = readFileSync(join(SRC, 'wubi98-lex.tsv'), 'utf8').split('\n').filter((l) => l.trim())
  return lines.map((l, i) => {
    const [code, word, w] = l.replace(/\r$/, '').split('\t')
    return { code, word, weight: Number(w), idx: i }
  })
}
