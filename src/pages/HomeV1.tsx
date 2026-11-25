import { useState } from 'react'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { DECK, PIN } from '../data'
import { Slide } from '../Slide'
import { btn, cx, LiveDot, Logo } from '../ui'

const DEMO_PIN = PIN.replace(/\D/g, '')

const Icon = ({ d, className = 'size-5' }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden><path d={d} /></svg>
)
const I = {
  arrow: 'M5 12h14M13 6l6 6-6 6',
  phone: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2',
  screen: 'M3 4h18v12H3zM8 20h8M12 16v4',
  flame: 'M12 22c4 0 7-3 7-7 0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-5 5-5 8 0 4 3 7 7 7z',
  heart: 'M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-3 4.5 4.5 0 0 1 8 3c0 6-8 11-8 11z',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6',
  up: 'M12 19V5M5 12l7-7 7 7',
}

/** Staggered entrance: each block fades/blurs in after the previous one. */
const enter = (i: number): CSSProperties => ({ animationDelay: `${120 + i * 110}ms` })

function PinEntry() {
  const nav = useNavigate()
  const [pin, setPin] = useState('')
  const [err, setErr] = useState(false)
  const [shake, setShake] = useState(0)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (pin === DEMO_PIN) return nav('/live')
    setErr(true)
    setShake(n => n + 1)
  }

  return (
    <form onSubmit={submit} className="glass flex flex-col rounded-[1.75rem] p-5">
      <div className="flex items-center gap-2 text-orange-300">
        <Icon d={I.phone} className="size-4" />
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.2em]">Vou assistir</span>
      </div>
      <label htmlFor="pin" className="mt-2 font-display text-lg font-semibold text-white">Digite o PIN do telão</label>
      <div key={shake} className={cx('relative mt-3 grid grid-cols-6 gap-1.5', shake > 0 && 'animate-shake')}>
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} aria-hidden className={cx(
            'grid h-12 place-items-center rounded-xl border font-mono text-xl font-medium text-white transition',
            err ? 'border-rose-400/60 bg-rose-500/10' : i === pin.length ? 'border-orange-300/70 bg-orange-400/10' : pin[i] ? 'border-white/20 bg-white/10' : 'border-white/10 bg-black/20',
            i === 2 && 'mr-1.5',
          )}>{pin[i] ?? ''}</span>
        ))}
        <input
          id="pin" value={pin} inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-invalid={err} aria-describedby="pin-hint"
          onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setErr(false) }}
          className="absolute inset-0 cursor-text rounded-xl bg-transparent text-transparent caret-transparent outline-none"
        />
      </div>
      <p id="pin-hint" role={err ? 'alert' : undefined} className={cx('mt-2 text-xs', err ? 'text-rose-300' : 'text-emerald-100/55')}>
        {err ? 'PIN não encontrado. Confira o número no telão.' : <>Demo: <span className="font-mono text-emerald-100/80">{PIN}</span></>}
      </p>
      <button disabled={pin.length < 6} className={btn('accent', 'lg', 'mt-4 w-full cursor-pointer')}>
        Entrar na sessão <Icon d={I.arrow} className="size-4" />
      </button>
    </form>
  )
}

function Bubble({ d, className, style }: { d: string; className: string; style?: CSSProperties }) {
  return (
    <span style={style} className={cx('liquid animate-float absolute grid size-12 place-items-center rounded-full bg-gradient-to-b text-ink', className)}>
      <Icon d={d} />
    </span>
  )
}

function Stage() {
  return (
    <div aria-hidden className="relative grid h-full place-items-center [perspective:1600px]">
      {/* Orbit rings */}
      <div className="animate-orbit absolute aspect-square w-[118%] rounded-full border border-dashed border-emerald-300/15" />
      <div className="animate-orbit absolute aspect-square w-[88%] rounded-full border border-orange-300/15 [animation-direction:reverse] [animation-duration:60s]">
        <span className="absolute left-1/2 top-0 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-400 shadow-[0_0_20px_4px] shadow-orange-500/60" />
      </div>
      <div className="absolute size-[60%] rounded-full bg-emerald-400/20 blur-[90px]" />

      {/* Tilted big screen */}
      <div className="relative w-[86%] [transform:rotateY(-16deg)_rotateX(7deg)] [transform-style:preserve-3d]">
        <div className="glass rounded-[1.6rem] p-2.5">
          <div className="relative overflow-hidden rounded-2xl ring-1 ring-white/10">
            <Slide s={DECK[0]} />
            <div className="animate-scan absolute inset-x-0 top-0 h-[10%] bg-gradient-to-b from-transparent via-emerald-200/25 to-transparent" />
          </div>
          <div className="flex items-center justify-between px-2 pb-0.5 pt-2.5 font-mono text-[11px] text-emerald-100/60">
            <span className="flex items-center gap-1.5 text-orange-300"><LiveDot /> AO VIVO</span>
            <span>PIN {PIN}</span>
            <span>287 conectados</span>
          </div>
        </div>

        {/* Floating audience cards */}
        <div className="glass animate-float absolute -left-[12%] top-[56%] w-[52%] rounded-2xl p-3 [animation-delay:-2s] [transform:translateZ(60px)]">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-orange-300"><Icon d={I.up} className="size-3" />42 votos</div>
          <p className="mt-1 text-[13px] leading-snug text-white">Como lidar com partição de rede sem perder consistência?</p>
        </div>
        <div className="glass animate-float absolute -right-[8%] -top-[14%] w-[44%] rounded-2xl p-3 [animation-delay:-4s] [transform:translateZ(80px)]">
          <div className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">Enquete ao vivo</div>
          {[['Consistência', 46], ['Disponibilidade', 30]].map(([l, v]) => (
            <div key={l} className="mt-2">
              <div className="flex justify-between text-[11px] text-emerald-50"><span>{l}</span><span>{v}%</span></div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-lime-300" style={{ width: `${v}%` }} /></div>
            </div>
          ))}
        </div>
      </div>

      <Bubble d={I.flame} className="right-[6%] top-[68%] from-orange-300 to-orange-500" />
      <Bubble d={I.heart} className="right-[18%] top-[80%] size-10 from-emerald-300 to-emerald-500" style={{ animationDelay: '-1.5s' }} />
      <Bubble d={I.spark} className="left-[4%] top-[14%] size-10 from-lime-200 to-lime-400" style={{ animationDelay: '-3s' }} />
    </div>
  )
}

const Card = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cx('glass flex flex-col rounded-[1.75rem] p-5', className)}>{children}</div>
)

export default function Home() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden lg:h-dvh">
      {/* Vertical glass strips over the backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0 flex">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="h-full flex-1 border-r border-white/[0.035] bg-gradient-to-b from-white/[0.025] via-transparent to-white/[0.02]" />
        ))}
      </div>

      <header className="animate-enter relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link to="/live" className={btn('quiet', 'sm', 'hidden sm:inline-flex')}>Ver demo ao vivo</Link>
          <Link to="/upload" className={btn('ghost', 'sm')}>Entrar</Link>
        </nav>
      </header>

      <div className="relative z-10 mx-auto grid w-full max-w-7xl flex-1 items-center gap-6 px-5 pb-6 sm:px-8 lg:min-h-0 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
        <section className="flex flex-col">
          <div className="animate-enter inline-flex w-fit items-center gap-2 rounded-full border border-orange-300/30 bg-orange-400/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-orange-200" style={enter(0)}>
            <LiveDot /> Apresentações ao vivo
          </div>

          <h1 className="mt-5 font-display text-[clamp(2.6rem,6.4vw,5.6rem)] font-bold leading-[0.95] tracking-[-0.04em] text-white">
            <span className="animate-enter block" style={enter(1)}>Suba no palco.</span>
            <span className="animate-enter block bg-gradient-to-r from-emerald-300 via-lime-200 to-orange-400 bg-clip-text pb-1 text-transparent" style={enter(2)}>A plateia entra com um PIN.</span>
          </h1>

          <p className="animate-enter mt-5 max-w-lg text-base text-emerald-100/70 sm:text-lg [@media(max-height:720px)]:hidden" style={enter(3)}>
            Slides no telão. Perguntas, enquetes e reações no celular de cada pessoa — em tempo real, sem instalar nada.
          </p>

          <div className="animate-enter mt-7 grid gap-3 sm:grid-cols-2" style={enter(4)}>
            <PinEntry />
            <Card className="border-emerald-300/20">
              <div className="flex items-center gap-2 text-emerald-300">
                <Icon d={I.screen} className="size-4" />
                <span className="font-mono text-[11px] font-medium uppercase tracking-[0.2em]">Vou apresentar</span>
              </div>
              <h2 className="mt-2 font-display text-lg font-semibold text-white">Seu deck, ao vivo em segundos</h2>
              <p className="mt-2 flex-1 text-sm text-emerald-100/65">Envie PDF ou PowerPoint e ganhe um PIN para compartilhar com a sala.</p>
              <Link to="/upload" className={btn('primary', 'lg', 'mt-4 w-full')}>
                Entrar e apresentar <Icon d={I.arrow} className="size-4" />
              </Link>
            </Card>
          </div>

          <div className="animate-enter mt-6 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] uppercase tracking-[0.16em] text-emerald-100/45" style={enter(5)}>
            <span>Sem app</span><span className="text-orange-400/60">/</span>
            <span>Plateia sem cadastro</span><span className="text-orange-400/60">/</span>
            <span>PDF · PPTX</span>
          </div>
        </section>

        <div className="animate-enter hidden h-full max-h-[640px] lg:block" style={enter(3)}>
          <Stage />
        </div>
      </div>
    </main>
  )
}
