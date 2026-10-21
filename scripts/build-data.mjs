// Builds sharded JSON data for the site into public/data.
// Inputs (data-src/): ms-wubi.tsv (from extract-ms-lex.mjs), search-wubi data files, hanzi-writer-data, 黑体字根.ttf
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import opentype from 'opentype.js'
import { loadWubi, loadChars, loadHanziWriter, loadMs, SRC } from './lib/load.mjs'
import { buildRootModel, learnVariants, rootUnitsOf, segmentChar } from './lib/roots.mjs'
import { buildStrokeClassifier } from './lib/strokes.mjs'

const OUT = 'public/data'
// Windows sometimes refuses to remove the directory itself while a file handle lingers
// (editor, AV scanner); clearing its contents is enough for a rebuild.
if (existsSync(OUT)) for (const name of readdirSync(OUT)) rmSync(join(OUT, name), { recursive: true, force: true })
for (const d of ['c', 'k', 'w']) mkdirSync(join(OUT, d), { recursive: true })
const write = (p, v) => writeFileSync(join(OUT, p), JSON.stringify(v))
const hex = (u) => u.codePointAt(0).toString(16)
const isHan = (s) => /^\p{Script=Han}$/u.test(s) || s === '〇'

const wubi = loadWubi()
const chars = loadChars()
const model = buildRootModel(wubi, chars)
console.log('roots learned', model.seqs.size)
const tTrain = Date.now()
const classifyStroke = buildStrokeClassifier(chars, loadHanziWriter)
console.log('stroke classifier trained in', Date.now() - tTrain, 'ms')
// stroke types inferred from the vectors when data-chars disagrees with hanzi-writer's stroke count
const inferredSeqs = new Map()
for (const [ch, c] of chars) {
  const hw = loadHanziWriter(ch)
  if (hw && c.strokeSeq.length !== hw.strokes.length) inferredSeqs.set(ch, hw.medians.map(classifyStroke).join(''))
}
console.log('stroke types inferred for', inferredSeqs.size, 'chars')
const variantItems = []
for (const w of wubi.values()) {
  const c = chars.get(w.char)
  if (w.keyUnit || w.charUnit || w.strokeUnit || !c || !loadHanziWriter(w.char)) continue
  const ru = rootUnitsOf(w, model.idUnits)
  // variants come from traditional shapes (inferred stroke types) or roots never seen in hand-made segments
  if (inferredSeqs.has(w.char) || ru.some((u) => !model.seqs.has(u)))
    variantItems.push({ ru, ss: inferredSeqs.get(w.char) ?? c.strokeSeq })
}
const tVar = Date.now()
console.log('root variants learned', learnVariants(model, variantItems), `(${variantItems.length} candidates, ${Date.now() - tVar} ms)`)

// ---- Microsoft dictionary: candidate order = weight ascending (stable by file order)
const ms = loadMs()
const byCode = new Map()
for (const e of ms) {
  if (!byCode.has(e.code)) byCode.set(e.code, [])
  byCode.get(e.code).push(e)
}
for (const list of byCode.values()) list.sort((a, b) => a.weight - b.weight || a.idx - b.idx)

// [code, candidate rank (1-based), candidate count under that code]
const charCodes = new Map() // char -> [[code, rank, n]]
const wordCodes = new Map() // word -> [[code, rank, n]]
for (const [code, list] of byCode) {
  list.forEach((e, i) => {
    const target = [...e.word].length === 1 ? charCodes : wordCodes
    if (!target.has(e.word)) target.set(e.word, [])
    const arr = target.get(e.word)
    if (!arr.some((x) => x[0] === code)) arr.push([code, i + 1, list.length])
  })
}
const byLenThenCode = (a, b) => a[0].length - b[0].length || (a[0] < b[0] ? -1 : 1)
for (const arr of charCodes.values()) arr.sort(byLenThenCode)
for (const arr of wordCodes.values()) arr.sort(byLenThenCode)

// ---- code index shards (by first 2 letters)
const kShards = new Map()
for (const [code, list] of byCode) {
  const k = code.slice(0, 2)
  if (!kShards.has(k)) kShards.set(k, {})
  kShards.get(k)[code] = list.map((e) => e.word)
}
for (const [k, v] of kShards) write(`k/${k}.json`, v)

// ---- word -> codes shards (by first char codepoint >> 6)
const wShards = new Map()
for (const [word, codes] of wordCodes) {
  const b = (word.codePointAt(0) >> 6).toString(16)
  if (!wShards.has(b)) wShards.set(b, {})
  wShards.get(b)[word] = codes
}
for (const [b, v] of wShards) write(`w/${b}.json`, v)

// ---- roots: glyph path + key + name
const fontBuf = readFileSync(join(SRC, '98wb.otf'))
const font = opentype.parse(fontBuf.buffer.slice(fontBuf.byteOffset, fontBuf.byteOffset + fontBuf.length))
const keyCount = new Map()
const rootName = new Map() // unit -> { ch, prio, freq }; prio 0 = keyname, 1 = 成字字根
const considerName = (u, ch, prio) => {
  if (!ch) return
  // Basic CJK characters make the best labels; a root that only exists as an extension character (𠂇, 𠂉,
  // 䒑 …) still beats showing nothing at all, so it is accepted with a lower priority.
  const cp = ch.codePointAt(0)
  const ext = cp >= 0x3400 && cp <= 0x4dbf ? 2 : cp >= 0x20000 && cp <= 0x2fa1f ? 3 : 0
  if (!ext && (cp < 0x4e00 || cp > 0x9fff)) return
  const freq = chars.get(ch)?.freq ?? 0
  const cur = rootName.get(u)
  const p = ext || prio
  if (!cur || p < cur.prio || (p === cur.prio && freq > cur.freq)) rootName.set(u, { ch, prio: p, freq })
}
const bump = (u, k) => {
  if (!k) return
  if (!keyCount.has(u)) keyCount.set(u, {})
  const m = keyCount.get(u)
  m[k] = (m[k] ?? 0) + 1
}
for (const w of wubi.values()) {
  if (w.keyUnit || w.charUnit) {
    bump(w.units[0], w.code[0])
    considerName(w.units[0], w.char, w.keyUnit ? 0 : 1)
    continue
  }
  if (w.strokeUnit) continue
  const ru = rootUnitsOf(w, model.idUnits)
  ru.forEach((u, i) => bump(u, w.code[i]))
  if (ru.length < w.units.length) bump(w.units[w.units.length - 1], w.code[w.code.length - 1])
}
const aliases = JSON.parse(readFileSync('scripts/root-names.json', 'utf8'))
const usedUnits = new Set()
for (const w of wubi.values()) for (const u of w.units) usedUnits.add(u)
const roots = {}
for (const u of usedUnits) {
  const glyph = font.hasChar(u) ? font.charToGlyph(u) : null
  const path = glyph && glyph.path.commands.length ? glyph.getPath(0, 86, 100).toPathData(1) : ''
  const kc = keyCount.get(u) ?? {}
  const key = Object.entries(kc).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
  // id marks a glyph that only ever serves as an identification-code stand-in, so the root keyboard hides
  // it. A unit that also carries a name or an alias is a real root (二 三 土 士 力 彡 也 古 石 …) and stays.
  const name = rootName.get(u)?.ch ?? (u.codePointAt(0) < 0xe000 ? u : '')
  const alias = name ? '' : (aliases[hex(u)] ?? '')
  const r = { k: key, p: path, n: name, id: model.idUnits.has(u) && !name && !alias ? 1 : 0 }
  if (alias) r.a = alias
  roots[hex(u)] = r
}
write('roots.json', roots)

// ---- char details (by codepoint >> 4)
const cShards = new Map()
const stats = { chars: 0, decomposed: 0, strokes: 0, seg: { source: 0, exact: 0, approx: 0, inferred: 0 } }
const allChars = new Set([...charCodes.keys()].filter(isHan))
for (const ch of wubi.keys()) if (charCodes.has(ch)) allChars.add(ch)
for (const ch of allChars) {
  const w = wubi.get(ch)
  const c = chars.get(ch)
  const hw = loadHanziWriter(ch)
  const rec = { codes: charCodes.get(ch) ?? [] }
  if (c) {
    rec.py = c.pinyin
    rec.ids = c.ids
    rec.rad = c.radical
    rec.ss = c.strokeSeq
  }
  if (w) {
    stats.decomposed++
    rec.full = w.code
    rec.t = w.keyUnit ? 1 : w.strokeUnit ? 3 : w.charUnit ? 2 : 0
    const ru = w.keyUnit || w.charUnit || w.strokeUnit ? w.units : rootUnitsOf(w, model.idUnits)
    rec.r = ru.map(hex)
    if (rec.t === 0 && ru.length < w.units.length) rec.idu = hex(w.units[w.units.length - 1])
    if (w.flag) rec.flag = w.flag
    if (w.more) rec.more = w.more.replace(/^⊙/, '')
  }
  if (hw) {
    stats.strokes++
    rec.s = hw.strokes
    if (w && rec.t === 0) {
      const inferred = inferredSeqs.get(ch)
      const r = segmentChar(w, c, model, hw.strokes.length, inferred)
      if (r) {
        rec.seg = r.seg
        rec.q = r.quality
        // the fallback also dropped a trailing placeholder: keep the root list and the identification code in sync
        if (r.popped) {
          rec.r = r.ru.map(hex)
          rec.idu = hex(w.units[w.units.length - 1])
        }
        stats.seg[r.quality]++
        if (inferred) stats.seg.inferred++
      }
    }
  }
  stats.chars++
  const b = (ch.codePointAt(0) >> 4).toString(16)
  if (!cShards.has(b)) cShards.set(b, {})
  cShards.get(b)[ch] = rec
}
for (const [b, v] of cShards) write(`c/${b}.json`, v)

const meta = {
  entries: ms.length,
  codes: byCode.size,
  words: wordCodes.size,
  ...stats,
  files: cShards.size + kShards.size + wShards.size + 2,
}
write('meta.json', meta)
console.log(meta)
