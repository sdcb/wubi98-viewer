import type { RootInfo } from '../lib/data'

export const slotColor = (slot: number) => (slot >= 0 ? `var(--root-${slot})` : 'var(--stroke-uncovered)')

interface Props {
  id?: string
  roots: Record<string, RootInfo>
  size?: number | string
  color?: string
  className?: string
  title?: string
}

export function RootGlyph({ id, roots, size = '1.25em', color = 'currentColor', className = '', title }: Props) {
  const info = id ? roots[id] : undefined
  if (!info?.p) {
    const ch = info?.n || (id ? String.fromCodePoint(parseInt(id, 16)) : '?')
    return (
      <span className={className} style={{ color, fontSize: size }} title={title}>
        {ch}
      </span>
    )
  }
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`inline-block align-[-0.2em] ${className}`}
      role="img"
      aria-label={title || info.n || '字根'}
    >
      {title && <title>{title}</title>}
      <path d={info.p} fill={color} />
    </svg>
  )
}

/** Renders text with {g:hex:slot} glyph markers. */
export function RichText({ text, roots }: { text: string; roots: Record<string, RootInfo> }) {
  const parts = text.split(/(\{g:[0-9a-f]+:-?\d\})/)
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\{g:([0-9a-f]+):(-?\d)\}$/)
        if (!m) return <span key={i}>{p}</span>
        const slot = Number(m[2])
        return (
          <span
            key={i}
            className="mx-0.5 inline-flex items-center rounded-md px-1 align-middle"
            style={{ background: `color-mix(in srgb, ${slotColor(slot)} 14%, transparent)` }}
          >
            <RootGlyph id={m[1]} roots={roots} color={slotColor(slot)} size="1.3em" />
            {roots[m[1]]?.a && (
              <span className="ml-0.5 text-[0.8em]" style={{ color: slotColor(slot) }}>
                {roots[m[1]].a}
              </span>
            )}
          </span>
        )
      })}
    </>
  )
}
