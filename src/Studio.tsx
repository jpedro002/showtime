import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { useSession } from './Auth'
import { supabase } from './supabase'
import { cx, LiveDot, Logo } from './ui'

/** Stroke icons (24px grid). UI icons are SVG; emoji only appear as audience reaction content. */
const PATHS = {
  library: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  live: 'M4.9 19.1a10 10 0 0 1 0-14.2M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4M19.1 4.9a10 10 0 0 1 0 14.2M12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
  chart: 'M3 3v18h18M8 17v-6M13 17V7M18 17v-4',
  upload: 'M12 16V4M6 10l6-6 6 6M4 20h16',
  download: 'M12 4v12M6 10l6 6 6-6M4 20h16',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  message: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  flame: 'M12 22c4 0 7-3 7-7 0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-5 5-5 8 0 4 3 7 7 7z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  prev: 'M15 18l-6-6 6-6',
  next: 'M9 18l6-6-6-6',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  check: 'M20 6 9 17l-5-5',
  pin: 'M12 17v5M9 3h6M10 3v7l-4 4v3h12v-3l-4-4V3',
  poll: 'M4 6h10M4 12h16M4 18h7',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
  qr: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3z',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  file: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6',
  x: 'M18 6 6 18M6 6l12 12',
  screen: 'M3 4h18v12H3zM8 20h8M12 16v4',
  expand: 'M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5',
  shrink: 'M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  up: 'M18 15l-6-6-6 6',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
}
export type IconName = keyof typeof PATHS

export function Icon({ name, className = 'size-[18px]' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cx('shrink-0', className)} aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  )
}

const NAV: { to: string; label: string; icon: IconName; live?: boolean }[] = [
  { to: '/upload', label: 'Apresentações', icon: 'library' },
  { to: '/presenter', label: 'Ao vivo', icon: 'live', live: true },
  { to: '/relatorio', label: 'Relatórios', icon: 'chart' },
]
const SHORTCUTS: { to: string; label: string; icon: IconName }[] = [
  { to: '/live', label: 'Demonstração', icon: 'eye' },
]

function useUser() {
  const user = useSession()?.user
  const name: string = user?.user_metadata.full_name ?? user?.email ?? ''
  const avatar: string | undefined = user?.user_metadata.avatar_url
  const initials = name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return { name, email: user?.email ?? '', avatar, initials }
}

function Avatar({ u }: { u: ReturnType<typeof useUser> }) {
  return u.avatar
    ? <img src={u.avatar} alt="" referrerPolicy="no-referrer" className="size-9 shrink-0 rounded-full ring-1 ring-white/20" />
    : <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-orange-400 text-xs font-bold text-ink">{u.initials}</span>
}

const signOut = () => supabase.auth.signOut()

/** Floating liquid-glass sidebar: icon rail on lg, full labels on xl. */
function Sidebar() {
  const u = useUser()
  const item = ({ isActive }: { isActive: boolean }) => cx(
    'group flex h-11 items-center justify-center gap-3 rounded-2xl px-3 text-sm font-medium transition duration-150 xl:justify-start',
    isActive ? 'liquid bg-white/14 text-white' : 'text-emerald-100/65 hover:bg-white/6 hover:text-white',
  )
  const label = 'sr-only xl:not-sr-only xl:truncate'
  return (
    <nav aria-label="Estúdio" className="glass fixed inset-y-3 left-3 z-30 hidden w-[84px] flex-col rounded-[1.75rem] p-3 lg:flex xl:w-[264px] xl:p-4">
      <div className="flex h-11 items-center justify-center px-1 xl:justify-start"><Logo textClass="hidden xl:inline" /></div>
      <p className="mt-6 hidden px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-100/40 xl:block">Estúdio</p>
      <div className="mt-6 flex flex-col gap-1 xl:mt-2">
        {NAV.map(n => (
          <NavLink key={n.to} to={n.to} className={p => cx(item(p), 'group relative')}>
            <Icon name={n.icon} />
            <span className={label}>{n.label}</span>
            <Tip>{n.label}</Tip>
            {n.live && <span className="ml-auto hidden xl:flex"><LiveDot /></span>}
          </NavLink>
        ))}
      </div>
      <div className="mx-3 my-4 h-px bg-white/10" />
      <p className="hidden px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-100/40 xl:block">Atalhos</p>
      <div className="flex flex-col gap-1 xl:mt-2">
        {SHORTCUTS.map(n => (
          <NavLink key={n.to} to={n.to} className={p => cx(item(p), 'group relative')}>
            <Icon name={n.icon} />
            <span className={label}>{n.label}</span>
            <Tip>{n.label}</Tip>
          </NavLink>
        ))}
      </div>
      <div className="glass-soft mt-auto flex items-center justify-center gap-3 rounded-2xl p-2 xl:justify-start">
        <span className="hidden xl:block"><Avatar u={u} /></span>
        <span className="hidden min-w-0 flex-1 leading-tight xl:block">
          <span className="block truncate text-sm font-semibold text-white">{u.name}</span>
          <span className="block truncate text-xs text-emerald-100/50">{u.email}</span>
        </span>
        <button onClick={signOut} aria-label="Sair" className="group relative grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl text-emerald-100/60 transition hover:bg-white/8 hover:text-white">
          <Icon name="logout" />
          <Tip>Sair</Tip>
        </button>
      </div>
    </nav>
  )
}

/** Below lg: slim top bar + bottom dock with the three studio sections. */
function MobileNav() {
  const u = useUser()
  return (
    <>
      <div className="flex items-center justify-between px-4 pt-4 lg:hidden">
        <Logo />
        <div className="flex items-center gap-1">
          <Avatar u={u} />
          <button onClick={signOut} aria-label="Sair" className="grid size-11 cursor-pointer place-items-center rounded-xl text-emerald-100/60 hover:text-white"><Icon name="logout" /></button>
        </div>
      </div>
      <nav aria-label="Estúdio" className="glass fixed inset-x-3 bottom-3 z-30 flex rounded-[1.6rem] p-1.5 lg:hidden">
        {NAV.map(n => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => cx(
            'flex h-14 flex-1 flex-col items-center justify-center gap-1 rounded-[1.2rem] text-[11px] font-semibold transition',
            isActive ? 'liquid bg-white/14 text-white' : 'text-emerald-100/60',
          )}>
            <Icon name={n.icon} />{n.label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}

/** Shell for the presenter area (upload, console, reports). */
export function Studio({ kicker, title, sub, actions, children }: {
  kicker?: ReactNode; title: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode
}) {
  return (
    <div className="min-h-dvh pb-28 lg:pb-0 lg:pl-[96px] xl:pl-[276px]">
      <a href="#conteudo" className="sr-only z-50 rounded-full bg-orange-400 px-4 py-2 font-semibold text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Ir para o conteúdo</a>
      <Sidebar />
      <MobileNav />
      <main id="conteudo" className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">
        <header className="animate-fade-up flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            {kicker && <div className="flex flex-wrap items-center gap-2 text-sm text-emerald-100/60">{kicker}</div>}
            <h1 className="mt-1.5 text-balance font-display text-3xl font-bold tracking-tight text-white sm:text-[2.5rem] sm:leading-[1.08]">{title}</h1>
            {sub && <p className="mt-2 max-w-2xl text-pretty text-emerald-100/65">{sub}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
        <div className="mt-7">{children}</div>
      </main>
    </div>
  )
}

/** KPI tile. `accent` = the one filled liquid-green tile per row (the number that matters most). */
export function Stat({ label, value, icon, hint, accent, children }: {
  label: string; value: ReactNode; icon: IconName; hint?: ReactNode; accent?: boolean; children?: ReactNode
}) {
  return (
    <div className={cx('flex flex-col rounded-3xl p-4 sm:p-5', accent ? 'liquid bg-gradient-to-br from-emerald-500 to-emerald-800 shadow-emerald-950/60' : 'pane')}>
      <div className="flex items-start justify-between gap-2">
        <span className={cx('text-sm font-medium', accent ? 'text-emerald-50' : 'text-emerald-100/65')}>{label}</span>
        <span className={cx('grid size-9 place-items-center rounded-xl', accent ? 'bg-white/15 text-white' : 'bg-white/6 text-emerald-200')}><Icon name={icon} /></span>
      </div>
      <div className="mt-2 font-display text-3xl font-bold tabular-nums tracking-tight text-white">{value}</div>
      {hint && <div className={cx('mt-1 text-xs', accent ? 'text-emerald-50/80' : 'text-emerald-100/50')}>{hint}</div>}
      {children}
    </div>
  )
}

/** Title row of a pane. */
export function PaneHead({ title, sub, aside }: { title: ReactNode; sub?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-display text-lg font-semibold text-white">{title}</h2>
        {sub && <p className="text-sm text-emerald-100/55">{sub}</p>}
      </div>
      {aside}
    </div>
  )
}

/** Hover/focus label for icon-only rail items (labels are visible from xl up). */
function Tip({ children }: { children: string }) {
  return (
    <span aria-hidden className="glass pointer-events-none absolute left-full top-1/2 z-40 ml-3 -translate-x-1 -translate-y-1/2 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold text-white opacity-0 transition duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 xl:hidden">
      {children}
    </span>
  )
}
