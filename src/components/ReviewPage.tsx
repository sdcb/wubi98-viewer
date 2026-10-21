import { useEffect, useMemo, useState } from 'react'
import { getChar, getWordCodes, type RootInfo } from '../lib/data'
import { useHistory } from '../lib/history'
import { buildParts } from '../lib/explain'
import { RootGlyph, slotColor } from './RootGlyph'
import { charFullCode } from './WordCard'

interface Card {
  q: string
  codes: string[]
  glyphs: { id?: string; slot: number; letter: string }[]
}

export function ReviewPage({ roots, onSearch }: { roots: Record<string, RootInfo>; onSearch: (q: string) => void }) {
  const items = useHistory()
  const [onlyStar, setOnlyStar] = useState(true)
  const [seed, setSeed] = useState(0)
  const qs = useMemo(
    () => items.filter((x) => (onlyStar ? x.star : true) && /\p{Script=Han}/u.test(x.q)).map((x) => x.q),
    [items, onlyStar],
  )
  const [cards, setCards] = useState<Card[]>([])
  const [flipped, setFlipped] = useState<Set<string>>(new Set())

  useEffect(() => {
    let alive = true
    Promise.all(
      qs.map(async (q): Promise<Card> => {
        if ([...q].length === 1) {
          const rec = await getChar(q)
          if (!rec) return { q, codes: [], glyphs: [] }
          const full = charFullCode(rec)
          const parts = rec.r && rec.full ? buildParts(rec, roots) : []
          return {
            q,
            codes: [...new Set([full, ...rec.codes.map((c) => c[0])])].filter(Boolean),
            glyphs: parts.map((p) => ({ id: p.glyph, slot: p.color, letter: p.letter })),
          }
        }
        return { q, codes: (await getWordCodes(q)).map(([c, rank]) => (rank > 1 ? c + rank : c)), glyphs: [] }
      }),
    ).then((cs) => {
      if (!alive) return
      if (seed) cs.sort(() => Math.random() - 0.5)
      setCards(cs)
    })
    return () => {
      alive = false
    }
  }, [qs, roots, seed])

  const toggle = (q: string) =>
    setFlipped((s) => {
      const n = new Set(s)
      if (n.has(q)) n.delete(q)
      else n.add(q)
      return n
    })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-kai text-2xl">复习卡片</h2>
        <button className="btn" onClick={() => setOnlyStar(!onlyStar)}>
          {onlyStar ? '★ 仅易忘' : '全部历史'}
        </button>
        <button className="btn" onClick={() => setSeed(seed + 1)}>
          ⟳ 打乱
        </button>
        <button className="btn" onClick={() => setFlipped(flipped.size ? new Set() : new Set(cards.map((c) => c.q)))}>
          {flipped.size ? '全部盖住' : '全部翻开'}
        </button>
      </div>
      {cards.length === 0 && (
        <p className="card p-10 text-center text-ink-2 dark:text-white/50">
          {onlyStar ? '还没有标记为“易忘”的字词。查询时点击 ☆ 即可加入复习。' : '还没有查询记录。'}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {cards.map((c) => {
          const open = flipped.has(c.q)
          return (
            <div
              key={c.q}
              role="button"
              tabIndex={0}
              onClick={() => toggle(c.q)}
              onKeyDown={(e) => e.key === 'Enter' && toggle(c.q)}
              className="card flex aspect-[4/5] cursor-pointer select-none flex-col items-center justify-center gap-3 p-3 transition hover:-translate-y-0.5"
            >
              <span className={`font-kai ${[...c.q].length > 2 ? 'text-3xl' : 'text-6xl'}`}>{c.q}</span>
              {open ? (
                <div className="pop-in flex flex-col items-center gap-2">
                  {c.glyphs.length > 0 && (
                    <div className="flex gap-1.5">
                      {c.glyphs.map((g, i) => (
                        <span key={i} className="flex flex-col items-center">
                          {g.id ? <RootGlyph id={g.id} roots={roots} color={slotColor(g.slot)} size={22} /> : <span className="h-[22px]" />}
                          <span className="font-mono text-xs font-bold uppercase" style={{ color: slotColor(g.slot) }}>
                            {g.letter}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap justify-center gap-x-2 font-mono text-sm tracking-widest text-cinnabar dark:text-[#ff8a7a]">
                    {c.codes.map((x) => (
                      <span key={x}>{x}</span>
                    ))}
                  </div>
                  <button
                    className="text-xs text-ink-2 underline-offset-2 hover:underline dark:text-white/50"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSearch(c.q)
                    }}
                  >
                    查看详解
                  </button>
                </div>
              ) : (
                <span className="text-xs text-ink-2/60 dark:text-white/30">点击翻开</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
