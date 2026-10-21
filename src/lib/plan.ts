import { getChar, getWordCodes, type DictCode } from './data'

/** One committed chunk: a dictionary word or single character typed with one code. */
export interface Segment {
  text: string
  code: string
  rank: number
  /** candidates under the code */
  n: number
  /** '' = auto commit (unique 4-letter code), ' ' = space, '2'..'9' = pick by digit */
  commit: string
  keys: number
  /** search cost: keys plus penalties for forced picks / missing characters */
  cost: number
  /** no usable code in the dictionary */
  missing?: boolean
}

export interface TypingPlan {
  segs: Segment[]
  keys: number
  cost: number
  /** how many segments need a non-first candidate */
  picks: number
}

export const MAX_PLAN_CHARS = 40
const MAX_WORD_LEN = 12
const MISSING_COST = 1000
/** In no-pick mode a character that is never a first candidate may still be picked, but reluctantly. */
const FORCED_PICK_PENALTY = 20

/** Key that commits the candidate, or null when it would need paging (rank > 9). */
export function commitKey(code: string, rank: number, n: number): string | null {
  if (rank > 9) return null
  if (code.length === 4 && n === 1) return ''
  return rank === 1 ? ' ' : String(rank)
}

/** Cheapest way to type `text` with one code; `allowPick` permits candidates 2–9. */
export function bestSegment(text: string, codes: DictCode[], allowPick: boolean): Segment | null {
  let best: Segment | null = null
  for (const [code, rank, n] of codes) {
    if (!allowPick && rank > 1) continue
    const commit = commitKey(code, rank, n)
    if (commit === null) continue
    const keys = code.length + commit.length
    if (!best || keys < best.keys || (keys === best.keys && rank < best.rank)) {
      best = { text, code, rank, n, commit, keys, cost: keys }
    }
  }
  return best
}

const missingSeg = (text: string): Segment => ({ text, code: '', rank: 1, n: 0, commit: '', keys: 0, cost: MISSING_COST, missing: true })

const better = (a: TypingPlan, b: TypingPlan) =>
  a.cost - b.cost || a.segs.length - b.segs.length || a.picks - b.picks

/** Best segmentation into dictionary words/characters; ties prefer fewer segments, then fewer picks. */
export function solvePlan(options: (Segment | null)[][]): TypingPlan {
  const n = options.length
  const dp: (TypingPlan | null)[] = Array.from({ length: n + 1 }, () => null)
  dp[0] = { segs: [], keys: 0, cost: 0, picks: 0 }
  for (let j = 1; j <= n; j++) {
    for (let i = Math.max(0, j - MAX_WORD_LEN); i < j; i++) {
      const seg = options[i][j - i - 1]
      const prev = dp[i]
      if (!seg || !prev) continue
      const cand: TypingPlan = {
        segs: [...prev.segs, seg],
        keys: prev.keys + seg.keys,
        cost: prev.cost + seg.cost,
        picks: prev.picks + (seg.rank > 1 ? 1 : 0),
      }
      if (!dp[j] || better(cand, dp[j]!) < 0) dp[j] = cand
    }
  }
  return dp[n]!
}

export interface PlanResult {
  /** first candidates only (space / auto commit) */
  recommended: TypingPlan
  /** fewest keys allowing digit picks; null when it is not better than `recommended` */
  optimized: TypingPlan | null
  /** keystrokes when typing character by character with first candidates */
  perChar: number
}

export async function planTyping(chars: string[]): Promise<PlanResult> {
  const n = Math.min(chars.length, MAX_PLAN_CHARS)
  const rows = await Promise.all(
    Array.from({ length: n }, async (_, i) => {
      const words: string[] = []
      for (let len = 2; len <= MAX_WORD_LEN && i + len <= n; len++) words.push(chars.slice(i, i + len).join(''))
      const [rec, ...wordCodes] = await Promise.all([getChar(chars[i]), ...words.map((w) => getWordCodes(w))])
      return { ch: chars[i], charCodes: rec?.codes ?? [], words, wordCodes }
    }),
  )
  const build = (allowPick: boolean) =>
    rows.map(({ ch, charCodes, words, wordCodes }) => {
      let single = bestSegment(ch, charCodes, allowPick)
      if (!single && !allowPick) {
        const forced = bestSegment(ch, charCodes, true)
        single = forced && { ...forced, cost: forced.keys + FORCED_PICK_PENALTY }
      }
      return [single ?? missingSeg(ch), ...words.map((w, k) => bestSegment(w, wordCodes[k], allowPick))]
    })
  const noPick = build(false)
  const recommended = solvePlan(noPick)
  const optimized = solvePlan(build(true))
  const perChar = noPick.reduce((s, row) => s + row[0]!.keys, 0)
  return { recommended, optimized: optimized.keys < recommended.keys ? optimized : null, perChar }
}
