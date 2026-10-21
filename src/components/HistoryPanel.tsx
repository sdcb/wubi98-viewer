import { useRef, useState } from 'react'
import { history, useHistory } from '../lib/history'

interface Props {
  open: boolean
  onClose: () => void
  onSearch: (q: string) => void
  onReview: () => void
}

function ago(t: number) {
  const s = (Date.now() - t) / 1000
  if (s < 60) return '刚刚'
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} 天前`
  return new Date(t).toLocaleDateString()
}

export function HistoryPanel({ open, onClose, onSearch, onReview }: Props) {
  const items = useHistory()
  const [filter, setFilter] = useState<'all' | 'star'>('all')
  const [kw, setKw] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const list = items.filter((x) => (filter === 'all' || x.star) && (!kw || x.q.includes(kw)))
  const starCount = items.filter((x) => x.star).length

  const doExport = () => {
    const blob = new Blob([history.exportJson()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `wubi98-history-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const doImport = async (f: File) => {
    try {
      const n = history.importJson(await f.text())
      alert(`已导入 ${n} 条记录`)
    } catch {
      alert('导入失败：文件格式不正确')
    }
  }
  const doClear = () => {
    if (!items.length) return
    if (filter === 'star') {
      if (confirm(`确定移除全部 ${starCount} 个易忘标记的记录吗？`))       history.clearStarred()
      return
    }
    const msg = starCount
      ? `清空查询历史？已标记易忘的 ${starCount} 条会保留（如需一并清除，请切到「易忘」页再清空）。`
      : '确定清空全部查询历史吗？'
    if (confirm(msg)) history.clear(true)
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-black/20 backdrop-blur-[2px] transition-opacity ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />
      <aside
        className={`fixed right-0 top-0 z-40 flex h-full w-full max-w-sm flex-col border-l border-black/5 bg-paper/95 shadow-2xl backdrop-blur transition-transform duration-300 dark:border-white/10 dark:bg-[#1b1815]/95 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <h2 className="font-kai text-2xl">查询记录</h2>
          <button className="btn !px-2.5" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        <div className="flex gap-2 px-5">
          {(['all', 'star'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-sm transition ${
                filter === f ? 'bg-ink text-paper dark:bg-white dark:text-black' : 'bg-black/5 dark:bg-white/10'
              }`}
            >
              {f === 'all' ? `全部 ${items.length}` : `★ 易忘 ${starCount}`}
            </button>
          ))}
          <input
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            placeholder="筛选"
            className="min-w-0 flex-1 rounded-full border border-black/10 bg-transparent px-3 text-sm outline-none focus:border-cinnabar/50 dark:border-white/15"
          />
        </div>

        <ul className="mt-3 flex-1 overflow-y-auto px-3">
          {list.length === 0 && (
            <li className="px-2 py-10 text-center text-sm text-ink-2 dark:text-white/40">
              {items.length ? '没有匹配的记录' : '还没有查询记录，查过的字词会自动保存在本机浏览器里。'}
            </li>
          )}
          {list.map((x) => (
            <li
              key={x.q}
              className="group flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-black/[0.04] dark:hover:bg-white/5"
            >
              <button
                onClick={() => history.toggleStar(x.q)}
                className={`text-lg ${x.star ? 'text-amber-500' : 'text-black/20 hover:text-amber-400 dark:text-white/20'}`}
                title={x.star ? '取消易忘标记' : '标记为易忘'}
              >
                {x.star ? '★' : '☆'}
              </button>
              <button
                className="min-w-0 flex-1 truncate text-left"
                onClick={() => {
                  onSearch(x.q)
                  onClose()
                }}
              >
                <span className={/^[a-z]+$/.test(x.q) ? 'font-mono tracking-wider' : 'font-kai text-xl'}>{x.q}</span>
              </button>
              <span className="shrink-0 text-xs text-ink-2/70 dark:text-white/35">
                {x.count > 1 && `${x.count} 次 · `}
                {ago(x.last)}
              </span>
              <button
                onClick={() => history.remove(x.q)}
                className="shrink-0 px-1 text-black/30 opacity-0 transition hover:text-cinnabar group-hover:opacity-100 dark:text-white/30"
                title="删除"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-2 border-t border-black/5 p-4 text-sm dark:border-white/10">
          <button className="btn" onClick={onReview} disabled={!starCount}>
            复习易忘
          </button>
          <button className="btn" onClick={doExport}>
            导出
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            导入
          </button>
          <button className="btn ml-auto hover:!text-cinnabar" onClick={doClear}>
            清空
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) doImport(f)
              e.target.value = ''
            }}
          />
        </div>
      </aside>
    </>
  )
}
