// Learns stroke-type sequences of every wubi root (PUA glyph) from the known segment data.
import { solveSegments, solveSegmentsAnyOrder, solveSegmentsLoose } from './segment.mjs'
import { approxSegments } from './approx.mjs'

const isSplit = (idx) => idx.some((x, i) => i > 0 && x !== idx[i - 1] + 1)

export function buildRootModel(wubi, chars) {
  const idUnits = new Set()
  for (const w of wubi.values()) if (w.flag) idUnits.add(w.units[w.units.length - 1])

  const learned = new Map()
  const split = new Map()
  const add = (u, s, sp) => {
    if (!s) return
    if (!learned.has(u)) learned.set(u, new Map())
    const m = learned.get(u)
    m.set(s, (m.get(s) ?? 0) + 1)
    if (sp !== undefined) {
      const v = split.get(u) ?? [0, 0]
      v[0] += sp ? 1 : 0
      v[1]++
      split.set(u, v)
    }
  }
  for (const w of wubi.values()) {
    const c = chars.get(w.char)
    if (!c) continue
    if (w.keyUnit || w.charUnit) { add(w.units[0], c.strokeSeq); continue }
    if (!w.segments || w.strokeUnit) continue
    const ru = rootUnitsOf(w, idUnits)
    if (w.segments.length !== ru.length) continue
    if (w.segments.some((s) => !s.length || s.some((x) => x == null || x >= c.strokeSeq.length))) continue
    // interleaved roots (兆) are split by necessity; keep them out of the split-rate prior
    w.segments.forEach((idx, i) => add(ru[i], idx.map((k) => c.strokeSeq[k]).join(''), w.interleaved ? undefined : isSplit(idx)))
  }
  const seqs = new Map()
  for (const [u, m] of learned) {
    const e = [...m.entries()].sort((a, b) => b[1] - a[1])
    const top = e[0][1]
    seqs.set(u, e.filter(([, n], i) => i === 0 || n >= Math.max(2, top * 0.15)).map((x) => x[0]))
  }
  const splitRate = new Map([...split].map(([u, [a, b]]) => [u, (a + 0.1) / (b + 1)]))
  return { idUnits, seqs, splitRate, variants: new Map() }
}

/**
 * Units without the trailing identification-code placeholder. A placeholder may reuse the code point of
 * a real root, so it is only recognised reliably through a character declaring the identification code in
 * `flag`. Data source rule: drop the last unit when the character has a flag and its last unit is a known
 * placeholder. Safety net for flag-less records (the 98 table fills the flag column for only ~5% of them):
 * drop it as well when that unit never learned any stroke sequence, i.e. it cannot possibly be a real root.
 */
export function rootUnitsOf(w, idUnits, seqs) {
  const u = w.units.slice()
  if (!u.length) return u
  const last = u[u.length - 1]
  if (!last || !idUnits?.has(last)) return u
  if (w.flag) {
    u.pop()
    return u
  }
  if (seqs && !seqs.get(last)?.length) u.pop()
  return u
}

// Learns extra stroke sequences of roots (e.g. traditional 4-stroke 艹 "2121", 糹 "554444") from characters the
// model cannot segment exactly: when every other root matches exactly and the remaining root's chunk is unambiguous.
// items: [{ ru: root units, ss: stroke-type string }]. Learned variants are tracked in model.variants so results
// relying on them can be flagged as approximate.
export function learnVariants(model, items, minCount = 3) {
  const found = new Map()
  for (const { ru, ss } of items) {
    const seqs = ru.map((u) => model.seqs.get(u) ?? [])
    const gap = ru.length === 4
    if (seqs.filter((q) => !q.length).length > 1) continue
    if (seqs.every((q) => q.length)) {
      if (solveSegments(seqs, ss, gap, 1).length) continue
      if ((solveSegmentsAnyOrder(seqs, ss, gap)?.cost ?? Infinity) <= 3) continue
    }
    const subs = new Set()
    for (let a = 0; a < ss.length; a++) for (let L = 1; L <= 10 && a + L <= ss.length; L++) subs.add(ss.slice(a, a + L))
    for (let r = 0; r < ru.length; r++) {
      if (seqs.some((q, i) => i !== r && !q.length)) continue
      const trial = seqs.slice()
      trial[r] = [...subs]
      const sols = solveSegments(trial, ss, gap, 64)
      if (!sols.length || sols.length >= 64) continue
      const cand = new Set(sols.map((s) => (isSplit(s.seg[r]) ? '' : s.seg[r].map((i) => ss[i]).join(''))))
      if (cand.size !== 1) continue
      const v = [...cand][0]
      if (!v || seqs[r].includes(v) || (seqs[r].length && Math.abs(v.length - seqs[r][0].length) > 2)) continue
      if (!found.has(ru[r])) found.set(ru[r], new Map())
      const m = found.get(ru[r])
      m.set(v, (m.get(v) ?? 0) + 1)
    }
  }
  let added = 0
  for (const [u, m] of found)
    for (const [v, n] of m)
      if (n >= minCount) {
        model.seqs.set(u, [...(model.seqs.get(u) ?? []), v])
        if (!model.variants.has(u)) model.variants.set(u, new Set())
        model.variants.get(u).add(v)
        added++
      }
  return added
}

// returns { seg, quality: 'source' | 'exact' | 'approx', ru, popped } or null
// inferredSeq: stroke types inferred from the stroke vectors, used when data-chars' count disagrees with them
export function segmentChar(w, c, model, nStrokes, inferredSeq) {
  if (!c) return null
  const matches = c.strokeSeq.length === nStrokes
  if (!matches && inferredSeq?.length !== nStrokes) return null
  const ss = matches ? c.strokeSeq : inferredSeq
  // hand-made segment indices refer to data-chars' stroke order
  const s = matches ? w.segments : null
  const solve = (ru) => {
    const seqs = ru.map((u) => model.seqs.get(u) ?? [])
    const structSource =
      s && s.length === ru.length && s.every((x) => x.length && x.every((i) => Number.isInteger(i) && i < nStrokes))
    const validSource =
      structSource && s.every((x, r) => !seqs[r].length || seqs[r].includes(x.map((i) => ss[i]).join('')))
    if (validSource) return { seg: s, quality: 'source' }
    const gap = ru.length === 4
    // exact matches that rely on a learned root variant are only as good as the variant
    const exact = (seg) => ({
      seg,
      quality:
        seg.some((idx, r) => model.variants.get(ru[r])?.has(idx.map((i) => ss[i]).join(''))) ? 'approx' : 'exact',
    })
    if (seqs.every((q) => q.length)) {
      const sols = solveSegments(seqs, ss, gap)
      if (sols.length) {
        const score = (sol) =>
          sol.gaps * 0.5 +
          sol.seg.reduce((acc, idx, r) => {
            const rate = model.splitRate.get(ru[r]) ?? 0.05
            return acc + (isSplit(idx) ? 1 - rate : rate)
          }, 0)
        sols.sort((a, b) => score(a) - score(b))
        return exact(sols[0].seg)
      }
    }
    // Hand-made segments whose root shapes are deformed (e.g. 止 in 延) beat any fuzzy guess.
    if (structSource) return { seg: s, quality: 'approx' }
    if (seqs.every((q) => q.length)) {
      const any = solveSegmentsAnyOrder(seqs, ss, gap)
      if (any && any.cost <= 3) return exact(any.seg)
      const loose = solveSegmentsLoose(seqs, ss, gap)
      if (loose) return { seg: loose, quality: 'approx' }
    }
    const ap = approxSegments(seqs, ss, gap)
    if (ap && ap.cost <= Math.max(1, Math.floor(nStrokes / 4))) return { seg: ap.seg, quality: 'approx' }
    return null
  }
  const base = rootUnitsOf(w, model.idUnits)
  const first = solve(base)
  if (first) return { ...first, ru: base, popped: false }
  // Still unresolved: retry once with the extra placeholder rule, so a character that already segmented
  // keeps its previous result and only the failing ones can be improved by dropping the trailing unit.
  const wide = rootUnitsOf(w, model.idUnits, model.seqs)
  if (wide.length === base.length) return null
  const second = solve(wide)
  return second ? { ...second, ru: wide, popped: true } : null
}
