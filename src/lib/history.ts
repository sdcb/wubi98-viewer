import { useSyncExternalStore } from 'react'

export interface HistoryItem {
  q: string
  /** first lookup time (ms) */
  first: number
  /** last lookup time (ms) */
  last: number
  count: number
  star: boolean
}

const KEY = 'wubi98.history.v1'
const MAX = 500
let items: HistoryItem[] = load()
const listeners = new Set<() => void>()

function load(): HistoryItem[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => x && typeof x.q === 'string') : []
  } catch {
    return []
  }
}

function commit(next: HistoryItem[]) {
  items = next
  localStorage.setItem(KEY, JSON.stringify(items))
  listeners.forEach((l) => l())
}

window.addEventListener('storage', (e) => {
  if (e.key === KEY) {
    items = load()
    listeners.forEach((l) => l())
  }
})

export const history = {
  record(q: string) {
    q = q.trim()
    if (!q) return
    const now = Date.now()
    const old = items.find((x) => x.q === q)
    const rest = items.filter((x) => x.q !== q)
    const item = old ? { ...old, last: now, count: old.count + 1 } : { q, first: now, last: now, count: 1, star: false }
    const next = [item, ...rest]
    // keep starred items even beyond the limit
    commit(next.filter((x, i) => i < MAX || x.star))
  },
  toggleStar(q: string) {
    commit(items.map((x) => (x.q === q ? { ...x, star: !x.star } : x)))
  },
  remove(q: string) {
    commit(items.filter((x) => x.q !== q))
  },
  clear(keepStarred: boolean) {
    commit(keepStarred ? items.filter((x) => x.star) : [])
  },
  clearStarred() {
    commit(items.filter((x) => !x.star))
  },
  exportJson() {
    return JSON.stringify({ app: 'wubi98-viewer', version: 1, items }, null, 2)
  },
  importJson(text: string) {
    const data = JSON.parse(text)
    const incoming: HistoryItem[] = (Array.isArray(data) ? data : data.items ?? []).filter(
      (x: HistoryItem) => x && typeof x.q === 'string',
    )
    const map = new Map(items.map((x) => [x.q, x]))
    for (const x of incoming) {
      const cur = map.get(x.q)
      map.set(
        x.q,
        cur
          ? { ...cur, star: cur.star || !!x.star, count: Math.max(cur.count, x.count ?? 1), last: Math.max(cur.last, x.last ?? 0) }
          : { q: x.q, first: x.first ?? Date.now(), last: x.last ?? Date.now(), count: x.count ?? 1, star: !!x.star },
      )
    }
    commit([...map.values()].sort((a, b) => b.last - a.last))
    return incoming.length
  },
  isStarred(q: string) {
    return items.some((x) => x.q === q && x.star)
  },
}

export function useHistory(): HistoryItem[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => items,
  )
}
