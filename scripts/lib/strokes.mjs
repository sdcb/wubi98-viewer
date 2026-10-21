// Stroke-type inference from hanzi-writer medians, used when data-chars' stroke sequence disagrees with the
// hanzi-writer stroke count (e.g. traditional 4-stroke 艹 in 華). A k-nearest-neighbour classifier is trained on
// every character whose two sources agree (~99% accuracy on held-out characters).
// Types follow the data-chars convention: 1 横/提, 2 竖/竖钩, 3 撇, 4 点/捺, 5 折.

const N = 9
const K = 5

// direction of each of the N-1 equal arc-length pieces, plus log length (hanzi-writer is y-up)
function features(median) {
  const p = median.map(([x, y]) => [x, 900 - y])
  const L = [0]
  for (let i = 1; i < p.length; i++) L.push(L[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]))
  const T = L[L.length - 1] || 1
  const q = []
  let k = 1
  for (let s = 0; s < N; s++) {
    const t = (T * s) / (N - 1)
    while (k < p.length - 1 && L[k] < t) k++
    const a = L[k - 1] ?? 0, b = L[k] ?? 0, f = b > a ? (t - a) / (b - a) : 0
    const p0 = p[k - 1] ?? p[0], p1 = p[k] ?? p[0]
    q.push([p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f])
  }
  const v = new Float32Array(2 * (N - 1) + 1)
  for (let i = 1; i < N; i++) {
    const dx = q[i][0] - q[i - 1][0], dy = q[i][1] - q[i - 1][1], l = Math.hypot(dx, dy) || 1
    v[2 * i - 2] = dx / l
    v[2 * i - 1] = dy / l
  }
  v[v.length - 1] = Math.log(T + 1) / 2
  return v
}

// samples: iterable of [median, type]
export function trainStrokeClassifier(samples) {
  const X = [], Y = []
  for (const [m, t] of samples) {
    X.push(features(m))
    Y.push(t)
  }
  const D = 2 * (N - 1) + 1
  return function classify(median) {
    const f = features(median)
    const best = []
    for (let j = 0; j < X.length; j++) {
      const r = X[j]
      let d = 0
      for (let k = 0; k < D; k++) {
        const e = f[k] - r[k]
        d += e * e
      }
      if (best.length < K || d < best[best.length - 1][0]) {
        best.push([d, Y[j]])
        best.sort((a, b) => a[0] - b[0])
        if (best.length > K) best.pop()
      }
    }
    const votes = {}
    for (const [, t] of best) votes[t] = (votes[t] ?? 0) + 1
    return Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0]
  }
}

// trains on every character whose data-chars stroke count agrees with hanzi-writer
export function buildStrokeClassifier(chars, loadHanziWriter) {
  const samples = []
  for (const [ch, c] of chars) {
    const hw = loadHanziWriter(ch)
    if (hw?.medians.length === c.strokeSeq.length) hw.medians.forEach((m, i) => samples.push([m, c.strokeSeq[i]]))
  }
  return trainStrokeClassifier(samples)
}
