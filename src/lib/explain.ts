import type { CharRecord, RootInfo } from './data'
import { KEYS, STROKE_KEYS, STROKE_NAMES, STRUCT_NAMES, ZONE_NAMES, keyAt } from './keys'

export type PartKind = 'root' | 'keyname' | 'charroot' | 'stroke' | 'id' | 'pad'

export interface CodePart {
  letter: string
  kind: PartKind
  /** root glyph id (hex) if the part corresponds to a root glyph */
  glyph?: string
  /** stroke indices highlighted for this letter */
  strokes: number[]
  /** short label, e.g. "首笔·横" */
  label: string
  /** colour slot: 0..3 roots, 4 identification code, -1 none */
  color: number
}

export interface CodeExplain {
  code: string
  rank: number
  label: string
  note: string
  parts: CodePart[]
}

export interface CharExplain {
  /** parts for the full code (one per letter) */
  parts: CodePart[]
  full: string
  summary: string[]
  codes: CodeExplain[]
  /** stroke index -> colour slot */
  strokeColor: number[]
  approx: boolean
  uncovered: number[]
}

const STROKE_ZONE: Record<string, number> = { 横: 1, 提: 1, 竖: 2, 撇: 3, 点: 4, 捺: 4, 折: 5 }
const STRUCT_POS: Record<string, number> = { 左右: 1, 上下: 2, 杂合: 3 }

export function parseFlag(flag?: string) {
  const m = flag?.match(/^(.)·(左右|上下|杂合)/)
  if (!m) return null
  const zone = STROKE_ZONE[m[1]] ?? 0
  const pos = STRUCT_POS[m[2]]
  return { stroke: m[1], zone, pos, struct: STRUCT_NAMES[pos], key: zone ? keyAt(zone, pos) : '' }
}

/**
 * Identification code: prefer the flag stored with the character. When the data has none (the 98 table
 * fills that column for only a small share of the under-filled codes), derive it instead: the last stroke
 * type of the character gives the zone and the identification key gives the position, so the two agree
 * only for a genuine identification code and the pair is exactly the 区位 it encodes.
 */
export function idInfo(rec: CharRecord, idLetter: string) {
  const f = parseFlag(rec.flag)
  if (f) return { ...f, inferred: false }
  const ss = rec.ss || ''
  const zone = Number(ss[ss.length - 1] ?? 0)
  const k = KEYS[idLetter?.toLowerCase()]
  if (!zone || !k || k.zone !== zone) return null
  return { stroke: STROKE_NAMES[zone], zone, pos: k.pos, struct: STRUCT_NAMES[k.pos], key: k.key, inferred: true }
}

const up = (s: string) => s.toUpperCase()
export const rootName = (glyph: string | undefined, roots: Record<string, RootInfo>) =>
  (glyph && (roots[glyph]?.n || roots[glyph]?.a)) || ''

function strokeType(rec: CharRecord, i: number) {
  return Number(rec.ss?.[i] ?? 0)
}

export function buildParts(rec: CharRecord, roots: Record<string, RootInfo>): CodePart[] {
  const full = rec.full ?? ''
  const n = rec.s?.length ?? rec.ss?.length ?? 0
  const all = Array.from({ length: n }, (_, i) => i)
  const r = rec.r ?? []
  switch (rec.t) {
    case 1:
      return [...full].map((letter) => ({ letter, kind: 'keyname', glyph: r[0], strokes: all, label: '键名', color: 0 }))
    case 2: {
      const picks = [0, 1, n - 1]
      const names = ['首笔', '次笔', '末笔']
      return [...full].map((letter, i) => {
        if (i === 0) return { letter, kind: 'charroot', glyph: r[0], strokes: all, label: '报户口', color: 0 }
        const s = picks[i - 1]
        return { letter, kind: 'stroke', strokes: [s], label: `${names[i - 1]}·${STROKE_NAMES[strokeType(rec, s)]}`, color: i }
      })
    }
    case 3:
      return [...full].map((letter, i) =>
        i < 2
          ? { letter, kind: 'stroke', glyph: r[i], strokes: all, label: '单笔画', color: 0 }
          : { letter, kind: 'pad', strokes: [], label: '补 L', color: -1 },
      )
    default: {
      const parts: CodePart[] = r.map((g, i) => ({
        letter: full[i] ?? roots[g]?.k ?? '?',
        kind: 'root',
        glyph: g,
        strokes: rec.seg?.[i] ?? [],
        label: rootName(g, roots) || '字根',
        color: i,
      }))
      if (rec.idu && full.length > r.length) {
        const f = idInfo(rec, full[r.length])
        parts.push({
          letter: full[r.length],
          kind: 'id',
          glyph: rec.idu,
          strokes: n ? [n - 1] : [],
          label: f ? `识别码 ${f.zone}${f.pos}` : '识别码',
          color: 4,
        })
      }
      return parts
    }
  }
}

function shortLabel(len: number) {
  return ['', '一级简码', '二级简码', '三级简码'][len] ?? '简码'
}

export function explainChar(ch: string, rec: CharRecord, roots: Record<string, RootInfo>): CharExplain {
  const msCodes = rec.codes
  const msFull = [...msCodes].sort((a, b) => b[0].length - a[0].length)[0]?.[0] ?? ''
  const hasDecomp = !!rec.full && !!rec.r
  const full = hasDecomp && msCodes.some(([c]) => c === rec.full) ? rec.full! : hasDecomp ? rec.full! : msFull
  const parts = hasDecomp ? buildParts(rec, roots) : [...full].map((letter) => ({ letter, kind: 'pad' as PartKind, strokes: [], label: '', color: -1 }))
  const n = rec.s?.length ?? 0
  const strokeColor = Array<number>(n).fill(-1)
  if (rec.t === 0 || rec.t === undefined) {
    parts.forEach((p) => {
      if (p.kind === 'root') p.strokes.forEach((s) => (strokeColor[s] = p.color))
    })
  } else if (rec.t === 2 || rec.t === 1 || rec.t === 3) {
    // 键名字 / 成字字根 / 单笔画: the whole glyph is the one root, so painting every stroke with slot 0
    // would make the glyph identical to the first chip and hovering it would change nothing. Keep the
    // glyph in neutral ink (-3) and let the hover paint it in the chip's own colour.
    strokeColor.fill(-3)
  }
  const uncovered = rec.t === 0 && rec.seg ? strokeColor.flatMap((c, i) => (c === -1 ? [i] : [])) : []

  const summary: string[] = []
  const rootsText = (ps: CodePart[]) =>
    ps.map((p) => `{g:${p.glyph}:${p.color}} → ${up(p.letter)}`).join('，')
  if (!hasDecomp) {
    summary.push(`暂无「${ch}」的字根拆解数据，以下仅列出 98 五笔词库中的编码。`)
  } else if (rec.t === 1) {
    const k = KEYS[full[0]]
    summary.push(`「${ch}」是 ${up(full[0])} 键的键名字（${ZONE_NAMES[k.zone]}第 ${k.pos} 位，${k.zone}${k.pos}），规则：连敲四下该键 → ${up(full)}。`)
  } else if (rec.t === 2) {
    const k = KEYS[full[0]]
    summary.push(`「${ch}」本身就是一个成字字根（位于 ${up(full[0])} 键，区位 ${k.zone}${k.pos}）。`)
    summary.push(`成字字根规则：先“报户口”敲所在键 ${up(full[0])}，再依次取首笔、次笔、末笔的笔画键（横G 竖H 撇T 点Y 折N），不足四码时到此为止。`)
    summary.push(parts.slice(1).map((p) => `${p.label} → ${up(p.letter)}`).join('，') + '。')
  } else if (rec.t === 3) {
    summary.push(`「${ch}」是单笔画字根：先敲两次该笔画所在键 ${up(full.slice(0, 2))}，再补两个 L → ${up(full)}。`)
  } else {
    const rootParts = parts.filter((p) => p.kind === 'root')
    const idPart = parts.find((p) => p.kind === 'id')
    if (idPart) {
      summary.push(`「${ch}」只有 ${rootParts.length} 个字根：${rootsText(rootParts)}。`)
      const f = idInfo(rec, idPart.letter)
      if (f) {
        summary.push(
          `不足四码，需追加“末笔字型识别码”：末笔为「${f.stroke}」（${ZONE_NAMES[f.zone]}，第 ${f.zone} 区），字型为「${f.struct}」（第 ${f.pos} 位）→ 区位 ${f.zone}${f.pos} → ${up(f.key)}。`,
        )
      }
    } else if (rootParts.length >= 4) {
      summary.push(
        uncovered.length
          ? `「${ch}」的字根多于四个，按书写顺序取第一、二、三和最后一个字根（灰色笔画为不取码的部分）：${rootsText(rootParts)}。`
          : `「${ch}」恰好拆成四个字根，依次取码：${rootsText(rootParts)}。`,
      )
    } else {
      summary.push(`「${ch}」拆为 ${rootParts.length} 个字根：${rootsText(rootParts)}。`)
    }
    // the stroke types of these characters had to be estimated from the vector outlines
    if (rec.ss && rec.s?.length && rec.ss.length !== rec.s.length)
      summary.push(
        `（该字字库标注 ${rec.ss.length} 画、矢量笔画 ${rec.s.length} 笔，笔画类型按字形估算，拆解与识别码可能不够精确。）`,
      )
    else if (rec.q === 'approx') summary.push('（提示：该字的田字格高亮为程序自动推断，个别笔画可能不够精确。）')
  }
  if (hasDecomp && !msCodes.some(([c]) => c === rec.full)) {
    summary.push(`注意：按标准拆解得到 ${up(rec.full!)}，但 98 五笔词库中没有这个编码，实际请以下方词库编码为准。`)
  }

  const codes: CodeExplain[] = msCodes.map(([code, rank]) => {
    let label = '其他编码'
    let note = '98 五笔词库中收录的兼容/容错编码。'
    let ps: CodePart[] = []
    if (code === full) {
      label = '全码'
      note = code.length < 4 ? `全码只有 ${code.length} 位，敲完后按空格上屏。` : '敲满四码自动上屏。'
      ps = parts
    } else if (full.startsWith(code)) {
      label = shortLabel(code.length)
      note =
        code.length === 1
          ? '一级简码（高频字）：敲一个键 + 空格即可。'
          : `${label}：取全码的前 ${code.length} 位，再按空格上屏。`
      ps = parts.slice(0, code.length)
    } else if (code === rec.more) {
      label = '兼容码'
      note = '另一种拆分方式（如 GB 13000 / 10830 版），98 五笔同样支持。'
    }
    if (rank > 1) note += ` 在该编码下排第 ${rank} 位候选，需按 ${rank} 选择。`
    return { code, rank, label, note, parts: ps }
  })
  codes.sort((a, b) => a.code.length - b.code.length)

  return { parts, full, summary, codes, strokeColor, approx: rec.q === 'approx', uncovered }
}

export interface WordPick {
  ch: string
  code: string
  take: number[]
}

/** Which letters of each character's full code form a word code. */
export function wordRule(chars: string[]): { rule: string; picks: [number, number[]][] } {
  const n = chars.length
  if (n === 2) return { rule: '二字词：每个字各取全码的前两码。', picks: [[0, [0, 1]], [1, [0, 1]]] }
  if (n === 3) return { rule: '三字词：前两个字各取第一码，最后一个字取前两码。', picks: [[0, [0]], [1, [0]], [2, [0, 1]]] }
  if (n === 4)
    return { rule: '四字词：每个字各取第一码。', picks: [[0, [0]], [1, [0]], [2, [0]], [3, [0]]] }
  return {
    rule: '多字词：取第一、二、三和最后一个字的第一码。',
    picks: [[0, [0]], [1, [0]], [2, [0]], [n - 1, [0]]],
  }
}

export function strokeKeyLetter(type: number) {
  return STROKE_KEYS[type] ?? ''
}
