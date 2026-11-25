import type { ReactNode } from 'react'
import { Link } from 'react-router'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

type Variant = 'primary' | 'accent' | 'ghost' | 'danger' | 'quiet'
const VARIANTS: Record<Variant, string> = {
  primary: 'liquid bg-gradient-to-b from-emerald-400 to-emerald-600 text-ink shadow-emerald-500/40 hover:from-emerald-300 hover:to-emerald-500',
  accent: 'liquid bg-gradient-to-b from-orange-400 to-orange-600 text-ink shadow-orange-500/40 hover:from-orange-300 hover:to-orange-500',
  ghost: 'glass-soft text-emerald-50 hover:bg-white/10',
  danger: 'glass-soft text-rose-200 hover:bg-rose-500/15',
  quiet: 'text-emerald-100/80 hover:text-white hover:bg-white/5',
}
const SIZES = { sm: 'h-8 px-3 text-xs gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-6 text-base gap-2' }

/** Class string for buttons and button-like links. */
export const btn = (v: Variant = 'ghost', s: keyof typeof SIZES = 'md', extra?: string) =>
  cx('inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold transition duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40', VARIANTS[v], SIZES[s], extra)

export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink">
      <div className="animate-drift absolute -left-[10%] -top-[15%] size-[55vmax] rounded-full bg-emerald-500/25 blur-[120px]" />
      <div className="animate-drift absolute -bottom-[20%] -right-[10%] size-[50vmax] rounded-full bg-orange-500/20 blur-[120px] [animation-delay:-8s]" />
      <div className="animate-drift absolute left-[35%] top-[40%] size-[30vmax] rounded-full bg-lime-400/10 blur-[100px] [animation-delay:-15s]" />
      <div className="absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.05)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
    </div>
  )
}

export function Logo({ small }: { small?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 font-display font-bold tracking-tight text-white">
      <span className={cx('liquid grid place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-orange-500 text-ink', small ? 'size-7' : 'size-9')}>
        <svg viewBox="0 0 24 24" className="size-1/2" fill="currentColor" aria-hidden><path d="M7 4v16l13-8z" /></svg>
      </span>
      <span className={small ? 'text-base' : 'text-lg'}>Show<span className="text-orange-400">time</span></span>
    </Link>
  )
}

export function Segmented<T extends string>({ value, options, onChange, label, disabled }: {
  value: T; options: { v: T; label: ReactNode }[]; onChange: (v: T) => void; label: string; disabled?: boolean
}) {
  return (
    <div role="radiogroup" aria-label={label} className="glass-soft inline-flex rounded-full p-1">
      {options.map(o => (
        <button key={o.v} role="radio" aria-checked={value === o.v} disabled={disabled} onClick={() => onChange(o.v)}
          className={cx('rounded-full px-3.5 py-1.5 text-xs font-semibold transition', value === o.v ? 'liquid bg-gradient-to-b from-emerald-300 to-emerald-500 text-ink' : 'text-emerald-100/70 hover:text-white')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Switch({ on, onChange, label, hint }: { on: boolean; onChange: () => void; label: string; hint?: string }) {
  return (
    <button role="switch" aria-checked={on} onClick={onChange} className="flex w-full items-center justify-between gap-4 text-left">
      <span>
        <span className="block text-sm font-semibold text-white">{label}</span>
        {hint && <span className="block text-xs text-emerald-100/60">{hint}</span>}
      </span>
      <span className={cx('relative h-6 w-11 shrink-0 rounded-full border border-white/15 transition', on ? 'bg-emerald-500/80' : 'bg-white/10')}>
        <span className={cx('liquid absolute top-0.5 size-[18px] rounded-full bg-white transition-all', on ? 'left-[22px]' : 'left-0.5')} />
      </span>
    </button>
  )
}

const TONES = {
  green: 'bg-emerald-400/15 text-emerald-200 border-emerald-300/25',
  orange: 'bg-orange-400/15 text-orange-200 border-orange-300/30',
  gray: 'bg-white/8 text-emerald-50/70 border-white/12',
  red: 'bg-rose-400/15 text-rose-200 border-rose-300/25',
}
export function Chip({ tone = 'gray', children, className }: { tone?: keyof typeof TONES; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', TONES[tone], className)}>{children}</span>
}

export function LiveDot() {
  return (
    <span className="relative flex size-2">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-orange-400 opacity-75" />
      <span className="relative inline-flex size-2 rounded-full bg-orange-500" />
    </span>
  )
}

export function Toast({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div role="status" className="glass animate-fade-up fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-3 text-sm font-medium text-white">
      {msg}
    </div>
  )
}

export function Bar({ pct, mine }: { pct: number; mine?: boolean }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/8">
      <div className={cx('h-full rounded-full transition-all duration-500', mine ? 'bg-gradient-to-r from-orange-400 to-orange-500' : 'bg-gradient-to-r from-emerald-400 to-emerald-300')} style={{ width: pct + '%' }} />
    </div>
  )
}
