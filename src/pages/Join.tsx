import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { supabase } from '../supabase'
import { btn, Chip, cx, LiveDot, Logo } from '../ui'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']
const ERRORS = { pin: 'PIN não encontrado. Confira os números no telão.', other: 'Não foi possível entrar agora. Tente de novo.' }

export default function Join() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [digits, setDigits] = useState(() => (params.get('pin') ?? '').replace(/\D/g, '').slice(0, 6))
  const [step, setStep] = useState<'pin' | 'joining' | 'done'>('pin')
  const [error, setError] = useState<'' | 'pin' | 'other'>('')
  const [shakeN, setShakeN] = useState(0)
  const [nick, setNick] = useState('')
  const [joined, setJoined] = useState<{ sessionId: string; title: string } | null>(null)
  const [opening, setOpening] = useState(false)
  const autoSubmitted = useRef(false)

  const press = (k: string) => {
    setError('')
    setDigits(d => (k === 'del' ? d.slice(0, -1) : d.length >= 6 ? d : d + k))
  }

  const submit = async () => {
    if (digits.length < 6 || step !== 'pin') return
    setStep('joining')
    setError('')
    try {
      let user = (await supabase.auth.getSession()).data.session?.user
      if (!user) {
        const { data, error } = await supabase.auth.signInAnonymously()
        if (error) throw error
        user = data.user ?? undefined
      }
      const { data, error } = await supabase.rpc('join_session', { p_pin: digits, p_nickname: '' })
      if (error) throw error
      const deck = await supabase.from('decks').select('title').eq('id', data.deck_id).single()
      if (deck.error) console.error(deck.error)
      if (user && !user.is_anonymous) setNick(String(user.user_metadata.full_name ?? '').slice(0, 40))
      setJoined({ sessionId: data.session_id, title: deck.data?.title ?? 'Apresentação' })
      setStep('done')
    } catch (e) {
      const invalidPin = (e as { message?: string } | null)?.message?.includes('invalid pin') === true
      if (!invalidPin) console.error(e)
      setError(invalidPin ? 'pin' : 'other')
      if (invalidPin) setShakeN(n => n + 1)
      setStep('pin')
    }
  }

  const open = async () => {
    if (!joined) return
    const name = nick.trim()
    if (name) {
      setOpening(true)
      const { error } = await supabase.rpc('join_session', { p_pin: digits, p_nickname: name })
      setOpening(false)
      if (error) { console.error(error); setError('other'); return }
    }
    navigate('/watch/' + joined.sessionId)
  }

  const reset = () => { setStep('pin'); setDigits(''); setError(''); setJoined(null) }

  // QR code on the projector links to /join?pin=XXXXXX: submit it once on arrival.
  useEffect(() => {
    if (autoSubmitted.current) return
    autoSubmitted.current = true
    // oxlint-disable-next-line react/set-state-in-effect -- one-shot network join on arrival
    if (digits.length === 6) void submit()
  }, []) // oxlint-disable-line react-hooks/exhaustive-deps -- mount only

  // Physical keyboard support on desktop.
  useEffect(() => {
    if (step !== 'pin') return
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') press('del')
      else if (e.key === 'Enter') void submit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-6">
      <div className="flex items-center justify-between"><Logo small /><Link to="/" className={btn('quiet', 'sm')}>Início</Link></div>

      {step === 'pin' && (
        <section className="glass animate-fade-up mt-6 flex flex-1 flex-col rounded-[2rem] p-6">
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-white">Digite o PIN que está no telão</h1>
          <p className="mt-2 text-sm text-emerald-100/70">Sem cadastro. Você acompanha os slides, anota e pergunta direto do celular.</p>

          <div key={shakeN} role="group" aria-label="PIN de 6 dígitos" className={cx('mt-8 grid grid-cols-6 gap-2', error === 'pin' && 'animate-shake')}>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className={cx('grid h-14 place-items-center rounded-2xl border bg-white/5 font-display text-2xl font-semibold text-white transition',
                error === 'pin' ? 'border-rose-400/70' : i === digits.length ? 'border-orange-400 shadow-[0_0_0_4px_rgb(251_146_60/0.18)]' : digits[i] ? 'border-emerald-300/50' : 'border-white/10')}>
                {digits[i] ?? ''}
              </div>
            ))}
          </div>
          <div aria-live="polite" className={cx('mt-3 min-h-5 text-sm font-medium', error ? 'text-rose-300' : 'text-emerald-300')}>
            {error ? ERRORS[error] : digits.length === 6 ? 'Pronto, toque em Entrar.' : ''}
          </div>

          <div className="mt-auto grid grid-cols-3 gap-2.5 pt-6">
            {KEYS.map((k, i) => k === '' ? <div key={i} /> : (
              <button key={i} onClick={() => press(k)} aria-label={k === 'del' ? 'Apagar dígito' : undefined}
                className="glass-soft grid h-15 place-items-center rounded-2xl text-2xl font-medium text-white transition hover:bg-white/12 active:scale-95">
                {k === 'del' ? (
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 5H9l-6 7 6 7h12z" /><path d="M17 9l-5 6" /><path d="M12 9l5 6" /></svg>
                ) : k}
              </button>
            ))}
          </div>
          <button onClick={() => void submit()} disabled={digits.length < 6} className={btn('primary', 'lg', 'mt-4 w-full')}>Entrar</button>
        </section>
      )}

      {step === 'joining' && (
        <section role="status" className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="size-14 animate-spin rounded-full border-4 border-white/10 border-t-orange-400" />
          <div className="mt-6 font-display text-xl font-semibold text-white">Entrando na sala…</div>
          <div className="mt-2 max-w-64 text-sm text-emerald-100/65">Criando um acesso anônimo para guardar suas notas e seus votos.</div>
        </section>
      )}

      {step === 'done' && joined && (
        <section className="glass animate-fade-up mt-6 flex flex-1 flex-col rounded-[2rem] p-6">
          <Chip tone="orange" className="self-start"><LiveDot />AO VIVO</Chip>
          <h1 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight text-white">{joined.title}</h1>
          <ol className="mt-6 space-y-3">
            {['Os slides avançam sozinhos com o palestrante. Volte quando quiser para terminar uma nota.', 'Cada nota fica presa ao slide em que você escreveu.', 'Pergunte sem levantar a mão e vote nas dúvidas dos outros.'].map((t, i) => (
              <li key={i} className="glass-soft flex gap-3 rounded-2xl p-3 text-sm text-emerald-50/90">
                <span className="liquid grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-b from-emerald-300 to-emerald-500 text-xs font-bold text-ink">{i + 1}</span>{t}
              </li>
            ))}
          </ol>
          <label htmlFor="apelido" className="mt-6 text-sm font-semibold text-white">Como quer aparecer nas perguntas? <span className="font-normal text-emerald-100/50">(opcional)</span></label>
          <input id="apelido" value={nick} onChange={e => { setNick(e.target.value); setError('') }} placeholder="Anônimo" maxLength={40} autoComplete="nickname"
            className="mt-2 h-12 rounded-2xl border border-white/12 bg-white/5 px-4 text-white placeholder:text-emerald-100/35 focus:border-emerald-300/60 focus:outline-none" />
          <div aria-live="polite" className="mt-2 min-h-5 text-sm font-medium text-rose-300">{error && ERRORS.other}</div>
          <div className="mt-auto pt-6">
            <button onClick={() => void open()} disabled={opening} className={btn('primary', 'lg', 'w-full')}>{opening ? 'Abrindo…' : 'Abrir a apresentação'}</button>
            <button onClick={reset} className={btn('quiet', 'md', 'mt-2 w-full')}>Usar outro PIN</button>
          </div>
        </section>
      )}
    </main>
  )
}
