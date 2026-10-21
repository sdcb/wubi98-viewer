import { useState } from 'react'
import type { RootInfo } from '../lib/data'
import { KEYS, KEYBOARD_ROWS, ZONE_NAMES } from '../lib/keys'
import { RootGlyph } from './RootGlyph'

const ZONE_TINT = ['', 'var(--root-0)', 'var(--root-1)', 'var(--root-2)', 'var(--root-3)', 'var(--root-4)']
const KEY_GLYPHS = 6
const ZONE_ORDER = [
  ['g', 'f', 'd', 's', 'a'],
  ['h', 'j', 'k', 'l', 'm'],
  ['t', 'r', 'e', 'w', 'q'],
  ['y', 'u', 'i', 'o', 'p'],
  ['n', 'b', 'v', 'c', 'x'],
]

export function RootsPage({ roots, onSearch }: { roots: Record<string, RootInfo>; onSearch: (q: string) => void }) {
  const [sel, setSel] = useState<string | null>(null)
  const byKey = new Map<string, [string, RootInfo][]>()
  for (const [id, r] of Object.entries(roots)) {
    // id only hides glyphs that are nothing but an identification-code stand-in; a real root that happens to
    // share the code point (二 三 土 士 力 彡 也 古 石) has a name and belongs on the keyboard.
    if ((r.id && !r.n && !r.a) || !r.p || !r.k) continue
    if (!byKey.has(r.k)) byKey.set(r.k, [])
    byKey.get(r.k)!.push([id, r])
  }

  return (
    <div className="space-y-6">
      <section className="card p-4 sm:p-6">
        <h2 className="font-kai text-2xl">98 版五笔字根键盘</h2>
        <p className="mt-1 text-sm text-ink-2 dark:text-white/55">
          按起笔分为五区：横区 G F D S A、竖区 H J K L M、撇区 T R E W Q、点区 Y U I O P、折区 N B V C X。点击键位查看助记词与全部字根。
        </p>
        <div className="mt-5 overflow-x-auto pb-2">
          {KEYBOARD_ROWS.map((row, ri) => (
            <div key={row} className="mb-2 flex min-w-[680px] gap-2" style={{ paddingLeft: `${ri * 4}%` }}>
              {[...row].map((k) => {
                const info = KEYS[k]
                const list = byKey.get(k) ?? []
                return (
                  <button
                    key={k}
                    onClick={() => setSel(sel === k ? null : k)}
                    className={`relative flex min-h-32 min-w-0 flex-1 flex-col rounded-2xl border-2 bg-white/80 p-2 text-left transition hover:-translate-y-0.5 hover:shadow-md dark:bg-white/5 ${
                      sel === k ? 'shadow-lg ring-2 ring-offset-2 ring-offset-paper dark:ring-offset-[#151311]' : ''
                    }`}
                    style={{ borderColor: `color-mix(in srgb, ${ZONE_TINT[info.zone]} 45%, transparent)` }}
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="font-mono text-lg font-bold uppercase" style={{ color: ZONE_TINT[info.zone] }}>
                        {k}
                      </span>
                      <span className="text-[10px] text-ink-2/70 dark:text-white/40">
                        {info.zone}
                        {info.pos}
                      </span>
                    </div>
                    <span className="font-kai text-2xl leading-tight">{info.name}</span>
                    <span className="mt-auto flex flex-wrap content-end items-end gap-x-0.5 pt-1 text-ink-2 dark:text-white/70">
                      {list.slice(0, KEY_GLYPHS).map(([id]) => (
                        <RootGlyph key={id} id={id} roots={roots} size={17} className="!align-baseline" />
                      ))}
                      {list.length > KEY_GLYPHS && (
                        <span className="text-[10px] leading-[17px] text-ink-2/60 dark:text-white/35">+{list.length - KEY_GLYPHS}</span>
                      )}
                    </span>
                  </button>
                )
              })}
              {ri === 2 && (
                <div className="flex min-h-32 min-w-0 flex-1 flex-col justify-center rounded-2xl border-2 border-dashed border-black/10 p-2 text-xs text-ink-2 dark:border-white/10 dark:text-white/40">
                  <span className="font-mono text-lg font-bold">Z</span>
                  学习键 / 万能键
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {sel && (
        <section id="key-detail" className="card pop-in scroll-mt-4 p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-4">
            <span className="keycap h-14 w-14 border-black/15 bg-white text-3xl dark:border-white/20 dark:bg-white/10">
              {sel}
            </span>
            <div>
              <div className="font-kai text-2xl">
                {KEYS[sel].name} · {ZONE_NAMES[KEYS[sel].zone]}第 {KEYS[sel].pos} 位
              </div>
              <div className="mt-1 text-ink-2 dark:text-white/60">助记词：{KEYS[sel].mnemonic}</div>
            </div>
            <button className="btn ml-auto" onClick={() => onSearch(sel)}>
              查看 {sel.toUpperCase()} 键候选 →
            </button>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {(byKey.get(sel) ?? []).map(([id, r]) => (
              <button
                key={id}
                onClick={() => r.n && onSearch(r.n)}
                className="flex flex-col items-center rounded-xl bg-black/[0.035] px-2 pb-1 pt-2 transition hover:bg-black/[0.07] dark:bg-white/5 dark:hover:bg-white/10"
                title={r.n ? `查看「${r.n}」` : undefined}
              >
                <RootGlyph id={id} roots={roots} size={40} />
                <span className="h-4 text-[11px] text-ink-2 dark:text-white/40">{r.n || r.a}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="card p-5 sm:p-7">
        <h2 className="font-kai text-2xl">五笔字根口诀</h2>
        <p className="mt-1 text-sm text-ink-2 dark:text-white/55">98 版字根助记词，按区位顺序排列。点击任意一句查看该键全部字根。</p>
        <div className="mt-4 grid gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
          {ZONE_ORDER.map((keys, zi) => (
            <div key={zi}>
              <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold" style={{ color: ZONE_TINT[zi + 1] }}>
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: ZONE_TINT[zi + 1] }} />
                {zi + 1} 区 · {ZONE_NAMES[zi + 1]}
              </div>
              <ol className="space-y-0.5">
                {keys.map((k) => (
                  <li key={k}>
                    <button
                      onClick={() => {
                        setSel(k)
                        requestAnimationFrame(() =>
                          document.getElementById('key-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
                        )
                      }}
                      className={`flex w-full items-baseline gap-3 rounded-lg px-2 py-1 text-left transition hover:bg-black/[0.05] dark:hover:bg-white/[0.07] ${
                        sel === k ? 'bg-black/[0.05] dark:bg-white/[0.08]' : ''
                      }`}
                    >
                      <span className="w-12 shrink-0 font-mono text-xs text-ink-2/70 dark:text-white/40">
                        <b className="text-sm uppercase" style={{ color: ZONE_TINT[zi + 1] }}>
                          {k}
                        </b>{' '}
                        {KEYS[k].zone}
                        {KEYS[k].pos}
                      </span>
                      <span className="font-kai text-lg leading-snug">{KEYS[k].mnemonic}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5 text-[15px] leading-7 sm:p-7">
        <h2 className="mb-2 font-kai text-2xl">取码规则速记</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>键名字（每键第一个字根，如 王 土 大 木 工）：连敲四下，例如「月」EEEE。</li>
          <li>成字字根：报户口（所在键）+ 首笔 + 次笔 + 末笔，例如「雨」FGHY。</li>
          <li>单笔画：一 GGLL、丨 HHLL、丿 TTLL、丶 YYLL、乙 NNLL。</li>
          <li>四个及以上字根：取第一、二、三和最后一个字根。</li>
          <li>不足四个字根：字根码后补“末笔字型识别码”——末笔所在区 + 字型（左右 1、上下 2、杂合 3）。</li>
          <li>词组：二字词各取前两码；三字词取前两字首码 + 末字前两码；四字及以上取一、二、三、末字首码。</li>
        </ul>
      </section>
    </div>
  )
}
