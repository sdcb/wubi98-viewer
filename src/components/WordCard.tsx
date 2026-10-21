import { useEffect, useState } from 'react'
import type { CharRecord, DictCode } from '../lib/data'
import { wordRule } from '../lib/explain'
import { commitKey, planTyping, type PlanResult, type Segment, type TypingPlan } from '../lib/plan'

interface Props {
  word: string
  codes: DictCode[]
  recs: (CharRecord | null)[]
  onSearch: (q: string) => void
}

export function charFullCode(rec: CharRecord | null): string {
  if (!rec) return ''
  if (rec.full && rec.codes.some(([c]) => c === rec.full)) return rec.full
  return [...rec.codes].sort((a, b) => b[0].length - a[0].length)[0]?.[0] ?? rec.full ?? ''
}

function CommitCap({ commit, size = 'md' }: { commit: string; size?: 'sm' | 'md' }) {
  if (!commit) return null
  const cls =
    size === 'sm'
      ? 'h-5 min-w-5 px-1 text-[10px] border-b-2'
      : 'h-7 min-w-7 px-1.5 text-xs'
  return (
    <span
      className={`keycap ${cls} ml-1 border-cinnabar/30 bg-cinnabar/10 text-cinnabar normal-case dark:text-[#ff8a7a]`}
      title={commit === ' ' ? '按空格上屏' : `按 ${commit} 选第 ${commit} 个候选`}
    >
      {commit === ' ' ? (
        <svg viewBox="0 0 16 8" className={size === 'sm' ? 'h-2 w-3.5' : 'h-2.5 w-4'} fill="none" stroke="currentColor" strokeWidth="1.8" aria-label="空格">
          <path d="M1.5 1v5.5h13V1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        commit
      )}
    </span>
  )
}

const commitLabel = (s: Pick<Segment, 'commit' | 'rank'>) =>
  s.commit === '' ? '四码唯一 · 自动上屏' : s.commit === ' ' ? '空格上屏' : `第 ${s.rank} 候选 · 按 ${s.rank}`

function SegmentChip({ seg, onSearch }: { seg: Segment; onSearch: (q: string) => void }) {
  if (seg.missing) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed border-black/15 px-3 py-2.5 opacity-70 dark:border-white/15">
        <span className="font-kai text-2xl">{seg.text}</span>
        <span className="text-[11px] text-ink-2 dark:text-white/50">词库无此字</span>
      </div>
    )
  }
  return (
    <button
      onClick={() => onSearch(seg.text)}
      title={`查看「${seg.text}」`}
      className="flex flex-col items-center gap-1.5 rounded-2xl border border-cinnabar/25 bg-white/80 px-3 py-2.5 transition hover:-translate-y-0.5 hover:border-cinnabar/50 dark:bg-white/5"
    >
      <span className="font-kai text-2xl leading-none">{seg.text}</span>
      <span className="flex items-center">
        <span className="font-mono text-base font-semibold tracking-[0.15em] text-cinnabar dark:text-[#ff8a7a]">
          {seg.code}
        </span>
        <CommitCap commit={seg.commit} size="sm" />
      </span>
      <span className="text-[10px] text-ink-2/80 dark:text-white/40">{commitLabel(seg)}</span>
    </button>
  )
}

function PlanBlock({
  title,
  plan,
  subtitle,
  muted,
  onSearch,
}: {
  title: string
  plan: TypingPlan
  subtitle: React.ReactNode
  muted?: boolean
  onSearch: (q: string) => void
}) {
  return (
    <div className={muted ? 'mt-5 border-t border-black/5 pt-4 dark:border-white/10' : ''}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className={`font-kai ${muted ? 'text-lg' : 'text-xl'}`}>{title}</h3>
        <span className="text-sm text-ink-2 dark:text-white/55">{subtitle}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-stretch gap-2">
        {plan.segs.map((s, i) => (
          <SegmentChip key={i} seg={s} onSearch={onSearch} />
        ))}
      </div>
    </div>
  )
}

function PlanPanel({ res, onSearch }: { res: PlanResult; onSearch: (q: string) => void }) {
  const { recommended: rec, optimized: opt } = res
  if (!rec.segs.length) return null
  const saved = res.perChar - rec.keys
  return (
    <section className="mt-6 rounded-2xl border border-black/5 bg-black/[0.025] p-4 sm:p-5 dark:border-white/10 dark:bg-white/[0.03]">
      <PlanBlock
        title="推荐打法"
        plan={rec}
        onSearch={onSearch}
        subtitle={
          <>
            不用选重，共 <b className="font-mono text-ink dark:text-white">{rec.keys}</b> 键
            {saved > 0 && (
              <>
                ，比逐字输入（{res.perChar} 键）省 <b className="text-emerald-600 dark:text-emerald-400">{saved}</b> 键
              </>
            )}
          </>
        }
      />
      {opt && (
        <PlanBlock
          title="优化打法"
          plan={opt}
          muted
          onSearch={onSearch}
          subtitle={
            <>
              共 <b className="font-mono text-ink dark:text-white">{opt.keys}</b> 键，再省{' '}
              <b className="text-emerald-600 dark:text-emerald-400">{rec.keys - opt.keys}</b> 键，但需要记住选重数字
            </>
          }
        />
      )}
      <p className="mt-4 text-[11px] leading-5 text-ink-2/70 dark:text-white/35">
        计键规则：编码位数 + 上屏键；四码且只有一个候选时自动上屏，否则第 1 候选按空格，第 2–9 候选按数字键；需要翻页的候选不计入。
      </p>
    </section>
  )
}

export function WordCard({ word, codes, recs, onSearch }: Props) {
  const chars = [...word]
  const { rule, picks } = wordRule(chars)
  const fulls = recs.map(charFullCode)
  const derived = picks.map(([ci, idx]) => idx.map((i) => fulls[ci]?.[i] ?? '?').join('')).join('')
  const takeMap = new Map(picks.map(([ci, idx]) => [ci, idx]))
  const [plan, setPlan] = useState<{ word: string; res: PlanResult } | null>(null)
  const inDict = codes.length > 0

  useEffect(() => {
    if (inDict) return
    let alive = true
    planTyping([...word]).then((res) => alive && setPlan({ word, res }))
    return () => {
      alive = false
    }
  }, [word, inDict])


  return (
    <article className="card pop-in p-5 sm:p-7">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
        <h2 className="font-kai text-5xl tracking-wide">{word}</h2>
        <span className="text-sm text-ink-2 dark:text-white/50">
          {inDict ? '词组' : '句子 / 未收录词组'} · {chars.length} 字
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {inDict ? (
          codes.map(([c, rank, n]) => {
            const commit = commitKey(c, rank, n)
            return (
              <button
                key={c}
                onClick={() => onSearch(c)}
                title={commit === null ? `第 ${rank} 候选，需要翻页` : commitLabel({ commit, rank })}
                className="flex items-center rounded-xl border border-cinnabar/30 bg-cinnabar/5 px-3 py-1.5 transition hover:bg-cinnabar/10"
              >
                <span className="font-mono text-xl font-semibold tracking-[0.2em] text-cinnabar dark:text-[#ff8a7a]">{c}</span>
                {commit === null ? (
                  <span className="ml-1 text-xs text-ink-2 dark:text-white/50">第 {rank} 候选</span>
                ) : (
                  <CommitCap commit={commit} />
                )}
              </button>
            )
          })
        ) : (
          <span className="text-ink-2 dark:text-white/60">98 五笔词库未收录整句，不能用一个编码直接打出，请按下方推荐打法分段输入。</span>
        )}
      </div>

      {!inDict && plan?.word === word && <PlanPanel res={plan.res} onSearch={onSearch} />}

      <p className="mt-6 text-[15px] leading-7">
        {inDict ? rule : `造词规则（仅供参考）：${rule}`}
      </p>
      <div className="mt-3 flex flex-wrap items-stretch gap-3">
        {chars.map((ch, ci) => {
          const take = takeMap.get(ci)
          const full = fulls[ci]
          return (
            <button
              key={ci}
              onClick={() => onSearch(ch)}
              className={`flex min-w-[84px] flex-col items-center gap-1 rounded-2xl border px-3 py-2.5 transition hover:-translate-y-0.5 ${
                take
                  ? 'border-cinnabar/30 bg-white/80 dark:bg-white/5'
                  : 'border-dashed border-black/10 opacity-60 dark:border-white/10'
              }`}
              title={`查看「${ch}」的拆解`}
            >
              <span className="font-kai text-3xl">{ch}</span>
              <span className="font-mono text-sm tracking-widest">
                {full
                  ? [...full].map((l, i) => (
                      <span
                        key={i}
                        className={take?.includes(i) ? 'rounded bg-cinnabar px-0.5 font-bold text-white' : 'opacity-40'}
                      >
                        {l}
                      </span>
                    ))
                  : '—'}
              </span>
              {!take && <span className="text-[10px]">不取码</span>}
            </button>
          )
        })}
      </div>
      {!inDict && !derived.includes('?') && (
        <p className="mt-3 text-xs text-ink-2/80 dark:text-white/45">
          若在输入法中手动造词，该词编码将为 <span className="font-mono tracking-widest">{derived}</span>；系统词库中不能直接用它打出。
        </p>
      )}
      {inDict && !codes.some(([c]) => c === derived) && !derived.includes('?') && (
        <p className="mt-3 text-xs text-ink-2/80 dark:text-white/45">
          注：按单字全码推得 {derived}，与词库编码不同，可能因单字存在其他取码方式，以词库为准。
        </p>
      )}
    </article>
  )
}
