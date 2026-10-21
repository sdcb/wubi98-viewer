import { useEffect, useMemo, useRef, useState } from 'react'
import type { CharRecord, RootInfo } from '../lib/data'
import { explainChar, type CodePart } from '../lib/explain'
import { KEYS } from '../lib/keys'
import { history, useHistory } from '../lib/history'
import { RichText, RootGlyph, slotColor } from './RootGlyph'
import { Tianzige } from './Tianzige'

interface Props {
  ch: string
  rec: CharRecord | null
  roots: Record<string, RootInfo>
  onSearch: (q: string) => void
  compact?: boolean
}

type Demo = { kind: 'split' | 'order'; step: number } | null

const IDC: Record<string, string> = {
  '⿰': '左右',
  '⿱': '上下',
  '⿲': '左中右',
  '⿳': '上中下',
  '⿴': '全包围',
  '⿵': '上三包围',
  '⿶': '下三包围',
  '⿷': '左三包围',
  '⿸': '左上包围',
  '⿹': '右上包围',
  '⿺': '左下包围',
  '⿻': '镶嵌',
}

function describeIds(ids: string) {
  const first = [...ids][0]
  const kind = IDC[first]
  if (!kind) return ''
  return `${kind}结构 · ${[...ids].filter((c) => !IDC[c]).join(' + ')}`
}

export function CharCard({ ch, rec, roots, onSearch, compact }: Props) {
  const ex = useMemo(() => (rec ? explainChar(ch, rec, roots) : null), [ch, rec, roots])
  const [hover, setHover] = useState<number | null>(null)
  const [demo, setDemo] = useState<Demo>(null)
  const timer = useRef<number | undefined>(undefined)
  const items = useHistory()
  const starred = items.some((x) => x.q === ch && x.star)

  useEffect(() => () => window.clearInterval(timer.current), [])

  if (!rec || !ex) {
    return (
      <div className="card pop-in flex items-center gap-6 p-6">
        <div className="w-24 shrink-0">
          <Tianzige strokeColor={[]} active={null} fallback={ch} />
        </div>
        <p className="text-ink-2 dark:text-white/60">98 五笔词库中没有收录「{ch}」。</p>
      </div>
    )
  }

  const nStrokes = rec.s?.length ?? 0
  // The drawn glyph is the vector data, so its stroke count is the number the user can actually count.
  // data-chars' count disagrees for a few hundred rare characters; keep it visible as a side note.
  const strokeCount = nStrokes || rec.ss?.length || 0
  const ssMismatch = !!rec.ss && nStrokes > 0 && rec.ss.length !== nStrokes
  const splitSteps = ex.parts.filter((p) => p.strokes.length && p.kind !== 'pad')

  const play = (kind: 'split' | 'order') => {
    window.clearInterval(timer.current)
    const total = kind === 'split' ? splitSteps.length : nStrokes
    let step = 0
    setDemo({ kind, step })
    timer.current = window.setInterval(
      () => {
        step++
        if (step > total + 1) {
          window.clearInterval(timer.current)
          setDemo(null)
          return
        }
        setDemo({ kind, step })
      },
      kind === 'split' ? 900 : 450,
    )
  }

  let strokeColor = ex.strokeColor
  let active: number[] | null = null
  let activeSlot: number | undefined
  let visible: number | undefined
  if (demo?.kind === 'split') {
    strokeColor = Array(nStrokes).fill(-2)
    splitSteps.slice(0, demo.step).forEach((p) => p.strokes.forEach((s) => (strokeColor[s] = p.color)))
  } else if (demo?.kind === 'order') {
    visible = demo.step
  } else if (hover !== null) {
    const p = ex.parts[hover]
    active = p.strokes
    activeSlot = p.color
  }

  const fullParts = ex.parts
  const hasStrokes = nStrokes > 0

  return (
    <article className="card pop-in overflow-hidden">
      <div className={`grid gap-6 p-5 sm:p-7 ${compact ? '' : 'md:grid-cols-[minmax(0,300px)_1fr]'}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-full max-w-[300px] rounded-2xl bg-[#fffdf8] p-2 shadow-inner dark:bg-black/20">
            <Tianzige
              strokes={rec.s}
              strokeColor={strokeColor}
              active={active}
              activeSlot={activeSlot}
              visible={visible}
              fallback={ch}
            />
          </div>
          {hasStrokes && (
            <div className="flex gap-2 text-sm">
              {splitSteps.length > 0 && (
                <button className="btn" onClick={() => play('split')}>
                  ▶ 拆解演示
                </button>
              )}
              <button className="btn" onClick={() => play('order')}>
                ✎ 笔顺
              </button>
            </div>
          )}
          {!hasStrokes && <p className="text-xs text-ink-2/70 dark:text-white/40">暂无该字的笔画矢量数据</p>}
          {hasStrokes && !rec.t && !splitSteps.length && (
            <p className="max-w-[280px] text-center text-xs leading-5 text-ink-2/70 dark:text-white/40">
              暂未推出该字的字根与笔画对应关系，大字只按原字形显示。
            </p>
          )}
        </div>

        <div className="min-w-0">
          <header className="flex flex-wrap items-start gap-x-4 gap-y-2">
            <h2 className="font-kai text-6xl leading-none">{ch}</h2>
            <div className="flex flex-col gap-1 pt-1 text-sm text-ink-2 dark:text-white/60">
              {rec.py && <span className="text-base">{rec.py}</span>}
              <span className="flex flex-wrap gap-x-3">
                {rec.ids && <span>{describeIds(rec.ids)}</span>}
                {rec.rad && <span>部首 {rec.rad}</span>}
                {strokeCount > 0 && (
                  <span
                    title={
                      ssMismatch
                        ? `矢量笔画 ${nStrokes} 笔，字库笔画标注为 ${rec.ss!.length} 画；本页以矢量笔数为准`
                        : undefined
                    }
                  >
                    {strokeCount} 画
                    {ssMismatch && (
                      <span className="ml-1 text-xs text-ink-2/60 dark:text-white/35">（字库标 {rec.ss!.length}）</span>
                    )}
                  </span>
                )}
              </span>
            </div>
            <button
              className={`ml-auto rounded-full border px-3 py-1 text-sm transition ${
                starred
                  ? 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300'
                  : 'border-black/10 text-ink-2 hover:border-amber-400 dark:border-white/15 dark:text-white/60'
              }`}
              onClick={() => {
                if (!items.some((x) => x.q === ch)) history.record(ch)
                history.toggleStar(ch)
              }}
              title="标记为易忘字，方便复习"
            >
              {starred ? '★ 易忘' : '☆ 标记易忘'}
            </button>
          </header>

          {fullParts.length > 0 && rec.r && (
            <div className="mt-5 flex flex-wrap items-end gap-2.5">
              {fullParts.map((p, i) => (
                <PartChip
                  key={i}
                  part={p}
                  roots={roots}
                  active={hover === i}
                  onEnter={() => setHover(i)}
                  onLeave={() => setHover(null)}
                />
              ))}
            </div>
          )}

          <div className="mt-5 space-y-2 leading-7 text-[15px]">
            {ex.summary.map((s, i) => (
              <p key={i} className={s.startsWith('（') ? 'text-xs text-ink-2/70 dark:text-white/40' : ''}>
                <RichText text={s} roots={roots} />
              </p>
            ))}
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-black/5 dark:border-white/10">
            {ex.codes.map((c) => (
              <div
                key={c.code}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-black/5 px-4 py-2.5 last:border-0 odd:bg-black/[0.015] dark:border-white/5 dark:odd:bg-white/[0.02]"
              >
                <button
                  className="font-mono text-lg font-semibold tracking-widest text-cinnabar hover:underline dark:text-[#ff8a7a]"
                  onClick={() => onSearch(c.code)}
                  title="查看该编码的所有候选"
                >
                  {c.code}
                </button>
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">{c.label}</span>
                {c.rank > 1 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-400/15 dark:text-amber-300">
                    第 {c.rank} 候选
                  </span>
                )}
                <span className="basis-full text-sm text-ink-2 sm:basis-auto sm:flex-1 dark:text-white/55">{c.note}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </article>
  )
}

function PartChip({
  part,
  roots,
  active,
  onEnter,
  onLeave,
}: {
  part: CodePart
  roots: Record<string, RootInfo>
  active: boolean
  onEnter: () => void
  onLeave: () => void
}) {
  const color = slotColor(part.color)
  const key = KEYS[part.letter]
  return (
    <button
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      className={`group flex w-[74px] flex-col items-center gap-1.5 rounded-2xl border-2 px-2 pb-2 pt-2.5 transition ${
        active ? 'scale-105 shadow-lg' : ''
      }`}
      style={{
        borderColor: part.color >= 0 ? color : 'transparent',
        background: `color-mix(in srgb, ${color} ${active ? 18 : 8}%, transparent)`,
      }}
      title={key ? `${part.letter.toUpperCase()} 键：${key.mnemonic}` : undefined}
    >
      <span className="flex h-9 items-center justify-center">
        {part.kind === 'pad' ? (
          <span className="text-sm opacity-50">补码</span>
        ) : part.glyph ? (
          <RootGlyph
            id={part.glyph}
            roots={roots}
            color={color}
            size={34}
            title={part.kind === 'id' ? part.label : undefined}
          />
        ) : (
          <span className="text-lg" style={{ color }}>
            {part.label.split('·')[1]}
          </span>
        )}
      </span>
      <span
        className="keycap h-8 w-8 border-black/15 bg-white text-base text-ink shadow-sm dark:border-white/20 dark:bg-white/10 dark:text-white"
        style={{ color }}
      >
        {part.letter}
      </span>
      <span className="max-w-full truncate text-[11px] text-ink-2 dark:text-white/50">{part.label}</span>
    </button>
  )
}
