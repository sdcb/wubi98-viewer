// Generates 98-version source data for the site:
//   data-src/data-wubi-v98.tsv  (same schema as the 86 file so load.mjs works)
//   data-src/wubi98-lex.tsv     (code<TAB>word<TAB>weight dictionary, replaces ms-wubi.tsv)
// Sources (UTF-16LE, from yanhuacuo/98wubi-tables):
//   data-src/src-wubi98-unicode.txt  char -> [※root※..※,※code※,(※py※,)※region※]
//   data-src/src-wubi98-phrase.txt   word -> code (single-meaning, priority order)
import { readFileSync, writeFileSync } from 'node:fs'
import opentype from 'opentype.js'

const SRC = 'data-src'
function readU16(p) {
  let s = readFileSync(p, 'utf16le')
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1)
  return s
}

// --- 98 classification constants -------------------------------------------------
const KEYNAMES = { g: '王', f: '土', d: '大', s: '木', a: '工', h: '目', j: '日', k: '口', l: '田', m: '山', t: '禾', r: '白', e: '月', w: '人', q: '金', y: '言', u: '立', i: '水', o: '火', p: '之', n: '已', b: '子', v: '女', c: '又', x: '纟' }
const KEYNAME_OF = Object.fromEntries(Object.entries(KEYNAMES).map(([k, v]) => [v, k]))
const STROKE_CODES = ['ggll', 'hhll', 'ttll', 'yyll', 'nnll'] // 一 丨 丿 丶 乙
// chars legitimately encoded with a single-stroke code
const STROKE_CHARS = new Set(['一', '丨', '丿', '丶', '乙', '乀', '乁', '乚', '乛', '亅'])
// stroke type (1横..5折) -> zone letter, used to validate 成字字根 codes
const ZONE_LETTER = ['', 'g', 'h', 't', 'y', 'n']
const ID_MARKER_MAX = 0xf00b0 // 末笔识别码 marker glyphs live below this
// 末笔字型识别码: zone(1横..5折) x pos(1左右 2上下 3杂合) -> letter
const REC = [
  ['g', 'f', 'd'],
  ['h', 'j', 'k'],
  ['t', 'r', 'e'],
  ['y', 'u', 'i'],
  ['n', 'b', 'v'],
]
const STROKE_NAME = ['', '横', '竖', '撇', '点', '折']
const STRUCT_NAME = ['', '左右', '上下', '杂合']

// --- load char metadata (version independent, UTF-8) -----------------------------
const chars = new Map()
{
  const lines = readFileSync(`${SRC}/data-chars.tsv`, 'utf8').split('\n').filter((l) => l.trim()).slice(1)
  for (const l of lines) {
    const f = l.replace(/\r$/, '').split('\t')
    chars.set(f[1], { ids: f[7], strokeSeq: f[11], freq: Number(f[12]) || 0 })
  }
}
function structPos(ids) {
  if (!ids) return 0
  const op = ids.codePointAt(0)
  // ⿰ U+2FF0, ⿲ 2FF2  -> 左右 ; ⿱ 2FF1, ⿳ 2FF3 -> 上下 ; else 杂合
  if (op === 0x2ff0 || op === 0x2ff2) return 1
  if (op === 0x2ff1 || op === 0x2ff3) return 2
  if (op >= 0x2ff0 && op <= 0x2ffb) return 3
  return 0
}
// 成字字根 decode order is 报户口 + 首笔 + 次笔 + 末笔, so every code letter after the first
// must match the zone (横竖撇点折) of the char's real stroke sequence. One unit per letter is
// also required, which rules out ordinary multi-root chars like 洲 (氵+丶+丿+丨).
// Returns [zone per unit] (0 for the 报户口 slot) when the letters align, else null.
function selfRootZones(meta, code, units) {
  const ss = meta?.strokeSeq
  if (!ss || ss.length < 2) return null
  if (code.length !== 3 && code.length !== 4) return null
  if (units.length !== code.length) return null
  const z = (i) => Number(ss[i])
  const letters = [null, ZONE_LETTER[z(0)], ZONE_LETTER[z(1)], ZONE_LETTER[z(ss.length - 1)]]
  for (let i = 1; i < code.length; i++) if (code[i] !== letters[i]) return null
  return [0, z(0), z(1), z(ss.length - 1)]
}
// 识别码 glyphs all draw the same small code-table figure and share one bounding box; the 98
// table appends such a unit to chars that need an identification code (汶 iyy, 血 tld, …).
const fontBuf = readFileSync(`${SRC}/98wb.otf`)
const font = opentype.parse(fontBuf.buffer.slice(fontBuf.byteOffset, fontBuf.byteOffset + fontBuf.length))
const markerBBox = font.charToGlyph(String.fromCodePoint(0xf000c)).getBoundingBox()
const markerCache = new Map()
function isIdMarker(cp) {
  if (!markerCache.has(cp)) {
    const s = String.fromCodePoint(cp)
    let hit = false
    if (font.hasChar(s)) {
      const bb = font.charToGlyph(s).getBoundingBox()
      hit =
        Math.abs(bb.x1 - markerBBox.x1) < 2 &&
        Math.abs(bb.y1 - markerBBox.y1) < 2 &&
        Math.abs(bb.x2 - markerBBox.x2) < 2 &&
        Math.abs(bb.y2 - markerBBox.y2) < 2
    }
    markerCache.set(cp, hit)
  }
  return markerCache.get(cp)
}
// 成字字根 check: aligned letters AND no 识别码 glyph after the 报户口.
// The marker test rejects chars like 汶/纪/秩/狃 whose letters happen to align.
function isSelfRootChar(meta, code, units) {
  return !!selfRootZones(meta, code, units) && !units.slice(1).some(isIdMarker)
}

// --- parse the 98 unicode split file --------------------------------------------
const rawLines = readU16(`${SRC}/src-wubi98-unicode.txt`).split(/\r?\n/).filter(Boolean)
function parseSplit(line) {
  const tab = line.indexOf('\t')
  if (tab < 0) return null
  const ch = line.slice(0, tab)
  let rest = line.slice(tab + 1).trim().replace(/^\[/, '').replace(/\]$/, '').replace(/^※/, '').replace(/※$/, '')
  const fields = rest.split('※,※')
  if (fields.length < 2) return null
  const roots = []
  for (const tok of fields[0].split('※')) {
    if (!tok) continue
    const cps = [...tok]
    if (cps.length !== 1) continue
    const cp = cps[0].codePointAt(0)
    if (cp >= 0xe000) roots.push(cp)
  }
  return { ch, roots, code: fields[1] }
}

const primary = new Map() // char -> parsed (first occurrence wins)
const charCodeSet = new Map() // char -> Set(codes)
for (const line of rawLines) {
  const p = parseSplit(line)
  if (!p || !p.roots.length || !/^[a-z]{1,4}$/.test(p.code)) continue
  if (!primary.has(p.ch)) primary.set(p.ch, p)
  if (!charCodeSet.has(p.ch)) charCodeSet.set(p.ch, new Set())
  charCodeSet.get(p.ch).add(p.code)
}

// --- build data-wubi-v98.tsv -----------------------------------------------------
const cols = [] // f0..f9 like 86
const stats = { key: 0, stroke: 0, char: 0, normal: 0, flagged: 0 }
for (const [ch, p] of primary) {
  let units = p.roots
  let code = p.code
  let keyUnit = 0, strokeUnit = 0, charUnit = 0, flag = ''

  if (KEYNAME_OF[ch]) {
    keyUnit = 1
    code = KEYNAME_OF[ch].repeat(4)
    units = [p.roots[0]]
  } else if (STROKE_CODES.includes(code) && STROKE_CHARS.has(ch)) {
    strokeUnit = 1
    charUnit = 1
  } else {
    const meta = chars.get(ch)
    if (isSelfRootChar(meta, code, units)) {
      charUnit = 1
    } else {
      // normal: detect 末笔字型识别码 on last unit
      if (meta && meta.strokeSeq && code.length >= 3) {
        const zone = Number(meta.strokeSeq[meta.strokeSeq.length - 1])
        const pos = structPos(meta.ids)
        if (zone >= 1 && zone <= 5 && pos >= 1 && pos <= 3) {
          const expect = REC[zone - 1][pos - 1]
          const lastGlyph = units[units.length - 1]
          const isId = code[code.length - 1] === expect && (lastGlyph < ID_MARKER_MAX || code.length <= 3)
          if (isId) flag = `${STROKE_NAME[zone]}·${STRUCT_NAME[pos]}`
        }
      }
    }
  }
  if (keyUnit) stats.key++
  else if (strokeUnit) stats.stroke++
  else if (charUnit) stats.char++
  else { stats.normal++; if (flag) stats.flagged++ }

  const unitsStr = units.map((cp) => String.fromCodePoint(cp)).join('※')
  cols.push([ch, code, '', '', keyUnit, strokeUnit, charUnit, `〖${unitsStr}〗`, flag, ''].join('\t'))
}
writeFileSync(`${SRC}/data-wubi-v98.tsv`, cols.join('\n') + '\n')

// --- build dictionary wubi98-lex.tsv (code<TAB>word<TAB>weight) ------------------
const MAXFREQ = 7e7
const seen = new Map() // `code\tword` -> min weight
function add(code, word, weight) {
  if (!/^[a-z]{1,4}$/.test(code)) return
  const key = `${code}\t${word}`
  if (!seen.has(key) || seen.get(key) > weight) seen.set(key, weight)
}
// 1) curated phrase / short-code table (already priority ordered)
const phraseLines = readU16(`${SRC}/src-wubi98-phrase.txt`).split(/\r?\n/).filter(Boolean)
phraseLines.forEach((l, i) => {
  const tab = l.indexOf('\t')
  if (tab < 0) return
  const word = l.slice(0, tab).trim()
  const code = l.slice(tab + 1).trim()
  if (word) add(code, word, i) // lower index = higher priority
})
// 2) every single char's full code(s) so rare chars are queryable
for (const [ch, codes] of charCodeSet) {
  const meta = chars.get(ch)
  const freq = meta ? meta.freq : 0
  const base = 200000 + Math.round((MAXFREQ - Math.min(freq, MAXFREQ)) / 100)
  for (const c of codes) add(c, ch, base)
}
const lex = [...seen.entries()].map(([k, w]) => `${k}\t${w}`)
writeFileSync(`${SRC}/wubi98-lex.tsv`, lex.join('\n') + '\n')

// --- sanity report ---------------------------------------------------------------
console.log('chars in split file:', primary.size)
console.log('classification:', stats)
console.log('lex entries:', lex.length)
const probe = (c) => {
  const row = cols.find((x) => x.startsWith(c + '\t'))
  if (!row) return console.log(c, 'MISSING')
  const f = row.split('\t')
  console.log(`${c}: code=${f[1]} key=${f[4]} stroke=${f[5]} char=${f[6]} flag='${f[8]}' units=${f[7].replace(/[〖〗]/g, '').split('※').length}`)
}
for (const c of ['王', '人', '一', '乙', '西', '雨', '明', '国', '湖', '胜', '五', '我']) probe(c)
