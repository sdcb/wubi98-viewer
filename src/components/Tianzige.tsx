import { slotColor } from './RootGlyph'

interface Props {
  strokes?: string[]
  /** colour slot per stroke: >=0 root slot, -1 not coded, -2 excluded by the split demo, -3 whole glyph is one root */
  strokeColor: number[]
  /** strokes emphasised by hover; null = show all colours */
  active: number[] | null
  /** colour used for the active strokes when hovering */
  activeSlot?: number
  /** number of strokes visible (for the demo animation) */
  visible?: number
  fallback?: string
  className?: string
}

export function Tianzige({ strokes, strokeColor, active, activeSlot, visible, fallback, className = '' }: Props) {
  const activeSet = active ? new Set(active) : null
  return (
    <svg viewBox="0 0 1024 1024" className={`aspect-square w-full ${className}`}>
      <rect x="8" y="8" width="1008" height="1008" rx="24" fill="none" stroke="var(--grid)" strokeWidth="8" />
      <g stroke="var(--grid)" strokeWidth="4" strokeDasharray="18 16" opacity="0.75">
        <line x1="512" y1="12" x2="512" y2="1012" />
        <line x1="12" y1="512" x2="1012" y2="512" />
        <line x1="12" y1="12" x2="1012" y2="1012" opacity="0.5" />
        <line x1="1012" y1="12" x2="12" y2="1012" opacity="0.5" />
      </g>
      {strokes ? (
        <g transform="translate(0, 900) scale(1, -1)">
          {strokes.map((d, i) => {
            const hidden = visible !== undefined && i >= visible
            let fill: string
            let opacity = 1
            if (activeSet) {
              const on = activeSet.has(i)
              fill = on ? slotColor(activeSlot ?? strokeColor[i]) : 'var(--stroke-uncovered)'
              opacity = on ? 1 : 0.45
            } else if (strokeColor[i] === -3) {
              // the whole glyph is a single root (键名字 / 成字字根 / 单笔画): neutral ink until hovered
              fill = 'var(--stroke-idle)'
            } else if (strokeColor[i] === -2) {
              fill = 'var(--stroke-uncovered)'
              opacity = 0.25
            } else {
              fill = strokeColor[i] === -1 ? 'var(--stroke-uncovered)' : slotColor(strokeColor[i])
            }
            return <path key={i} d={d} className="stroke-anim" fill={fill} opacity={hidden ? 0 : opacity} />
          })}
        </g>
      ) : (
        <text
          x="512"
          y="560"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="760"
          className="font-kai"
          fill="var(--stroke-idle)"
        >
          {fallback}
        </text>
      )}
    </svg>
  )
}
