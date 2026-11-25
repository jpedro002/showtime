import { useEffect, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { DECK, PIN, SEED_Q } from '../data'
import { Slide } from '../Slide'
import { btn, cx, LiveDot, Logo } from '../ui'

const DEMO_PIN = PIN.replace(/\D/g, '')
/** Hero choreography: 90ms steps, last block lands under 600ms total. */
const step = (i: number): CSSProperties => ({ animationDelay: `${i * 90}ms` })
/** Hover lift <100ms, press <150ms (motion-design timing). */
const lift = 'transition-[transform,background-color,box-shadow] duration-[90ms] ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] active:duration-[120ms]'

const Arrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
)

function PinForm() {
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
    <form onSubmit={submit} className="glass w-full max-w-md rounded-3xl p-2">
      <label htmlFor="pin" className="sr-only">PIN da apresentação</label>
      <div key={shake} className={cx('flex items-center gap-2', shake > 0 && 'animate-shake')}>
        <input
          id="pin" value={pin} inputMode="numeric" autoComplete="one-time-code" placeholder="PIN de 6 dígitos"
          aria-invalid={err} aria-describedby="pin-hint"
          onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setErr(false) }}
          className={cx(
            'h-14 min-w-0 flex-1 rounded-2xl bg-black/25 px-4 font-mono text-xl tracking-[0.35em] text-white outline-none transition placeholder:font-sans placeholder:text-base placeholder:tracking-normal placeholder:text-emerald-100/40',
            err ? 'ring-2 ring-rose-400/70' : 'focus:ring-2 focus:ring-orange-300/70',
          )}
        />
        <button className={btn('accent', 'lg', cx('h-14 rounded-2xl px-5', lift))} disabled={pin.length < 6}>
          Entrar <Arrow />
        </button>
      </div>
      <p id="pin-hint" role={err ? 'alert' : undefined} className={cx('px-3 pb-1 pt-2 text-xs', err ? 'text-rose-300' : 'text-emerald-100/55')}>
        {err ? 'PIN não encontrado. Confira o número no telão.' : <>Plateia: sem app, sem cadastro. Teste com <button type="button" onClick={() => setPin(DEMO_PIN)} className="cursor-pointer font-mono text-orange-300 underline decoration-orange-300/40 underline-offset-2 hover:decoration-orange-300">{PIN}</button></>}
      </p>
    </form>
  )
}

/** Live product frame: the real stage + question queue, votes ticking every 3s. */
function AppFrame() {
  const [qs, setQs] = useState(() => SEED_Q.filter(q => q.status === 'approved').slice(0, 3).map(q => ({ ...q, bump: 0 })))
  const [online, setOnline] = useState(284)

  useEffect(() => {
    const id = setInterval(() => {
      setQs(list => {
        const i = Math.floor(Math.random() * list.length)
        return list.map((q, j) => j === i ? { ...q, votes: q.votes + 1, bump: q.bump + 1 } : q).sort((a, b) => b.votes - a.votes)
      })
      setOnline(n => Math.max(250, Math.min(320, n + Math.round(Math.random() * 6 - 3))))
    }, 3000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="glass overflow-hidden rounded-[1.75rem] shadow-2xl shadow-black/50">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>{['bg-rose-400/70', 'bg-amber-300/70', 'bg-emerald-400/70'].map(c => <i key={c} className={cx('size-2.5 rounded-full', c)} />)}</span>
        <span className="truncate font-mono text-[11px] text-emerald-100/60">showtime.app/live · PIN {PIN}</span>
        <span className="ml-auto flex items-center gap-2 text-[11px] text-emerald-100/70"><LiveDot /> <b className="font-mono text-white tabular-nums">{online}</b> online</span>
      </div>
      <div className="grid gap-3 p-3 md:grid-cols-[1fr_15rem]">
        <Slide s={DECK[2]} className="rounded-2xl" />
        <div className="flex flex-col gap-2">
          <p className="px-1 font-mono text-[10px] uppercase tracking-[0.2em] text-orange-300">Perguntas mais votadas</p>
          {qs.map(q => (
            <div key={q.id} className="glass-soft flex items-start gap-2.5 rounded-xl p-2.5">
              <span key={q.bump} className={cx('grid min-w-9 place-items-center rounded-lg bg-emerald-400/15 py-1 font-mono text-xs font-semibold tabular-nums text-emerald-200', q.bump > 0 && 'animate-pop')}>
                ▲{q.votes}
              </span>
              <p className="line-clamp-2 text-xs leading-snug text-emerald-50/90">{q.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-7xl flex-col px-4 sm:px-8 lg:h-dvh lg:min-h-[640px]">
      <a href="#pin" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-ink">Ir para o PIN</a>
      <header className="flex h-20 shrink-0 items-center justify-between">
        <Logo />
        <nav className="flex items-center gap-1">
          <Link to="/live" className={btn('quiet', 'md', cx('hidden h-11 sm:inline-flex', lift))}>Ver demo ao vivo</Link>
          <Link to="/upload" className={btn('ghost', 'md', cx('h-11', lift))}>Entrar</Link>
        </nav>
      </header>

      <section className="grid flex-1 items-center gap-10 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-14 lg:py-0">
        <div className="flex flex-col items-start">
          <p className="animate-in inline-flex items-center gap-2 rounded-full border border-orange-300/25 bg-orange-400/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-orange-200" style={step(0)}>
            <LiveDot /> Apresentações ao vivo
          </p>
          <h1 className="animate-in mt-5 font-display text-[clamp(2.4rem,5.2vw,4.4rem)] font-semibold leading-[1.02] tracking-tight text-white" style={step(1)}>
            Seu PDF no telão.<br />
            <span className="bg-gradient-to-r from-emerald-300 via-lime-200 to-orange-300 bg-clip-text text-transparent">A plateia no celular.</span>
          </h1>
          <p className="animate-in mt-5 max-w-md text-base text-emerald-50/70 [@media(max-height:700px)]:hidden" style={step(2)}>
            Suba o PDF ou PPTX, mostre o PIN e a sala entra pelo navegador: perguntas votadas, enquetes e reações chegam ao palco na hora.
          </p>
          <div className="animate-in mt-8 w-full" style={step(3)}>
            <PinForm />
          </div>
          <div className="animate-in mt-5 flex items-center gap-3 text-sm text-emerald-100/60" style={step(4)}>
            <span>Vai apresentar?</span>
            <Link to="/upload" className={btn('primary', 'md', cx('h-11', lift))}>Subir apresentação <Arrow /></Link>
          </div>
        </div>

        <div className="animate-in relative" style={step(5)}>
          <div aria-hidden className="absolute -inset-8 -z-10 rounded-full bg-gradient-to-tr from-emerald-500/25 via-transparent to-orange-500/25 blur-3xl" />
          <AppFrame />
        </div>
      </section>

      <footer className="flex h-14 shrink-0 items-center gap-x-6 gap-y-1 font-mono text-[11px] uppercase tracking-[0.18em] text-emerald-100/40 max-sm:flex-wrap max-sm:py-4">
        <span>PDF · PPTX</span><span>Plateia sem cadastro</span><span>Relatório no fim</span>
      </footer>
    </main>
  )
}
