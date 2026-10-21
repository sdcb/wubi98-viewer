// Approximate segmentation: contiguous chunks, cost = edit distance to root stroke sequence.
// seqs[r] may be [] (unknown root -> wildcard with flat cost 1).
function lev(a, b) {
  const m = a.length, n = b.length
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 1; j <= n; j++) d[0][j] = j
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[m][n]
}

export function approxSegments(seqs, strokes, allowGap) {
  const n = strokes.length, k = seqs.length
  if (k === 0 || k > n) return null
  const cost = (r, a, b) => {
    const s = strokes.slice(a, b)
    if (!seqs[r].length) return 1
    return Math.min(...seqs[r].map((q) => lev(s, q)))
  }
  // dp[r][j] = min cost assigning roots < r to strokes < j
  const INF = 1e9
  const dp = Array.from({ length: k + 1 }, () => Array(n + 1).fill(INF))
  const from = Array.from({ length: k + 1 }, () => Array(n + 1).fill(null))
  dp[0][0] = 0
  for (let r = 0; r < k; r++)
    for (let a = 0; a <= n; a++) {
      if (dp[r][a] >= INF) continue
      const starts = allowGap && r === k - 1 ? Array.from({ length: n - a }, (_, i) => a + i) : [a]
      for (const s of starts)
        for (let b = s + 1; b <= n; b++) {
          if (r === k - 1 && b !== n) continue
          const c = dp[r][a] + cost(r, s, b) + (s - a) * 0.01
          if (c < dp[r + 1][b]) { dp[r + 1][b] = c; from[r + 1][b] = [a, s] }
        }
    }
  if (dp[k][n] >= INF) return null
  const seg = []
  let j = n
  for (let r = k; r > 0; r--) {
    const [a, s] = from[r][j]
    seg.unshift(Array.from({ length: j - s }, (_, i) => s + i))
    j = a
  }
  return { seg, cost: Math.round(dp[k][n]) }
}
