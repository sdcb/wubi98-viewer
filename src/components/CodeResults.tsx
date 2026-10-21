import { useEffect, useState, type ReactNode } from 'react'
import { getCodeShard, type RootInfo } from '../lib/data'
import { KEYS, ZONE_NAMES } from '../lib/keys'
import { RootGlyph } from './RootGlyph'

interface Props {
  code: string
  roots: Record<string, RootInfo>
  onSearch: (q: string) => void
  /** renders the explanation card of a single-character candidate */
  renderChar?: (ch: string) => ReactNode
}

interface Result {
  exact: [string, string[]][]
  more: [string, string[]][]
  error?: string
}

const MAX_MORE = 80

export function CodeResults({ code, roots, onSearch, renderChar }: Props) {
  const [res, setRes] = useState<Result | null>(null)

  useEffect(() => {
    let alive = true
    setRes(null)
    ;(async () => {
      if (code.slice(0, 2).includes('z')) {
        setRes({ exact: [], more: [], error: '万能键 Z 只支持出现在第 3、4 位。' })
        return
      }
      const shard = await getCodeShard(code)
      const re = new RegExp('^' + code.replace(/z/g, '[a-y]') + '$')
      const pre = new RegExp('^' + code.replace(/z/g, '[a-y]'))
      const entries = Object.entries(shard)
      const exact = entries.filter(([c]) => re.test(c)).sort((a, b) => (a[0] < b[0] ? -1 : 1))
      const more = entries
        .filter(([c]) => c.length > code.length && pre.test(c))
        .sort((a, b) => a[0].length - b[0].length || (a[0] < b[0] ? -1 : 1))
      if (alive) setRes({ exact, more })
    })().catch((e) => alive && setRes({ exact: [], more: [], error: String(e) }))
    return () => {
      alive = false
    }
  }, [code])

  const key = code.length === 1 ? KEYS[code] : undefined
  const keyRoots = key
    ? Object.entries(roots).filter(([, r]) => r.k === code && !(r.id && !r.n && !r.a) && r.p)
    : []

  return (
    <div className="space-y-5">
      {key && (
        <section className="card pop-in p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-4">
            <span className="keycap h-14 w-14 border-black/15 bg-white text-3xl shadow dark:border-white/20 dark:bg-white/10">
              {code}
            </span>
            <div>
              <div className="font-kai text-2xl">
                键名「{key.name}」· {ZONE_NAMES[key.zone]} {key.zone}
                {key.pos}
              </div>
              <div className="mt-1 text-ink-2 dark:text-white/60">助记词：{key.mnemonic}</div>
            </div>
          </div>
          {keyRoots.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {keyRoots.map(([id, r]) => (
                <span key={id} className="rounded-lg bg-black/[0.04] p-1.5 dark:bg-white/5" title={r.n || undefined}>
                  <RootGlyph id={id} roots={roots} size={28} />
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {!res && <p className="text-center text-ink-2 dark:text-white/50">加载中…</p>}
      {res?.error && <p className="text-center text-cinnabar">{res.error}</p>}
      {res && !res.error && (
        <>
          <section className="card pop-in p-5 sm:p-7">
            <h3 className="mb-3 text-sm font-medium tracking-wide text-ink-2 dark:text-white/50">
              编码 <span className="font-mono text-cinnabar dark:text-[#ff8a7a]">{code}</span> 的候选（98 五笔顺序）
            </h3>
            {res.exact.length === 0 && <p className="text-ink-2 dark:text-white/50">没有完全匹配该编码的字词。</p>}
            <div className="space-y-3">
              {res.exact.map(([c, words]) => (
                <div key={c}>
                  {res.exact.length > 1 && <div className="mb-1 font-mono text-xs text-ink-2 dark:text-white/40">{c}</div>}
                  <Candidates words={words} onSearch={onSearch} big />
                </div>
              ))}
            </div>
          </section>
          {renderChar &&
            [...new Set(res.exact.flatMap(([, words]) => words.filter((w) => [...w].length === 1)))]
              .slice(0, 3)
              .map((ch) => <div key={ch}>{renderChar(ch)}</div>)}
          {res.more.length > 0 && (
            <section className="card pop-in p-5 sm:p-7">
              <h3 className="mb-3 text-sm font-medium tracking-wide text-ink-2 dark:text-white/50">
                继续输入（共 {res.more.length} 个编码{res.more.length > MAX_MORE ? `，显示前 ${MAX_MORE} 个` : ''}）
              </h3>
              <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {res.more.slice(0, MAX_MORE).map(([c, words]) => (
                  <div key={c} className="flex min-w-0 items-baseline gap-3">
                    <button
                      className="w-12 shrink-0 text-left font-mono text-sm text-cinnabar hover:underline dark:text-[#ff8a7a]"
                      onClick={() => onSearch(c)}
                    >
                      {c}
                    </button>
                    <div className="min-w-0 truncate">
                      <Candidates words={words.slice(0, 6)} onSearch={onSearch} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function Candidates({ words, onSearch, big }: { words: string[]; onSearch: (q: string) => void; big?: boolean }) {
  return (
    <span className={`inline-flex flex-wrap gap-y-1.5 ${big ? 'gap-x-4' : 'gap-x-2.5'}`}>
      {words.map((w, i) => (
        <button
          key={w + i}
          onClick={() => onSearch(w)}
          className={`group inline-flex items-baseline gap-1 rounded-lg transition hover:text-cinnabar dark:hover:text-[#ff8a7a] ${
            big ? 'px-1.5 py-0.5 text-2xl' : 'text-base'
          }`}
        >
          <span className={`font-mono text-ink-2/60 dark:text-white/30 ${big ? 'text-xs' : 'text-[10px]'}`}>{i + 1}</span>
          <span className="font-kai">{w}</span>
        </button>
      ))}
    </span>
  )
}
