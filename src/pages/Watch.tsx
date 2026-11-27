import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { fmtPin, type HtmlDeck, type SessionRow } from '../decks'
import { DeckSlide } from '../HtmlSlide'
import { author, byRank, useLive, type Live } from '../live'
import { EMOJI, R_BG, type Kind } from '../room'
import { supabase } from '../supabase'
import { Icon, type IconName } from '../Studio'
import { btn, Check, Chip, cx, LiveDot, Toast } from '../ui'

const KINDS = Object.keys(EMOJI) as Kind[]
const field = 'w-full resize-none rounded-2xl border border-white/10 bg-black/30 p-3.5 text-base text-white outline-none transition placeholder:text-emerald-100/35 focus:border-emerald-300/70 focus:bg-black/40 sm:text-sm'

/** `/watch/:sessionId`: what the audience sees on their phone (or laptop). */
export default function Watch() {
  const { sessionId = '' } = useParams()
  const l = useLive(sessionId, 'audience')
  if (l.session && l.deck) return <Room l={l} s={l.session} deck={l.deck} sessionId={sessionId} />
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="glass animate-pop flex w-full max-w-xs flex-col items-center gap-4 rounded-[2rem] p-8 text-center">
        {l.error
          ? <span className="grid size-12 place-items-center rounded-2xl bg-rose-400/15 text-rose-200"><Icon name="x" className="size-6" /></span>
          : <span aria-hidden className="size-10 animate-spin rounded-full border-[3px] border-emerald-300/15 border-t-emerald-300" />}
        <p className="text-sm text-emerald-100/75">{l.error ?? 'Entrando na sala…'}</p>
        {l.error && <Link to="/join" className={btn('primary', 'md', 'w-full')}>Digitar o PIN</Link>}
      </div>
    </main>
  )
}

function Room({ l, s, deck, sessionId }: { l: Live; s: SessionRow; deck: HtmlDeck; sessionId: string }) {
  const [view, setView] = useState<number | null>(null) // null = follow the presenter
  const [tab, setTab] = useState<'notas' | 'qa' | 'poll'>('notas')
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [saved, setSaved] = useState(true)
  const [draft, setDraft] = useState('')
  const [anon, setAnon] = useState(false)
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState('')
  const [full, setFull] = useState(false)
  const [awake, setAwake] = useState(true) // fullscreen controls visible
  const [pops, setPops] = useState<{ id: number; kind: Kind; left: number }[]>([])
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const idle = useRef<ReturnType<typeof setTimeout>>(undefined)
  const touchX = useRef<number | null>(null)
  const panel = useRef<HTMLElement>(null)

  const cur = s.current_slide, n = deck.slides.length
  const ended = s.status === 'ended'
  const canBrowse = s.free_nav || ended
  const last = ended ? n - 1 : cur
  const eff = canBrowse && view !== null ? Math.min(view, last) : cur
  const following = eff === cur && view === null
  const p = l.poll && l.poll.status !== 'idle' ? l.poll : null
  const myOpt = p ? l.myPoll[p.id] : undefined
  const pTotal = p ? p.counts.reduce((a, b) => a + b, 0) : 0
  const pollWaiting = p?.status === 'open' && myOpt === undefined
  const qs = [...l.questions].filter(q => q.status === 'approved' || q.author_id === l.me).sort(byRank)
  const noted = Object.values(notes).filter(Boolean).length

  useEffect(() => {
    supabase.from('notes').select('slide, body').eq('session_id', sessionId)
      .then(({ data }) => setNotes(Object.fromEntries((data ?? []).map(x => [x.slide, x.body]))))
  }, [sessionId])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2600); return () => clearTimeout(t) }, [toast])

  // a poll launched while watching: tell the viewer, but don't yank them off the tab they're typing in
  const seenPoll = useRef(p?.id)
  useEffect(() => {
    if (p?.status === 'open' && p.id !== seenPoll.current) { seenPoll.current = p.id; setToast('Nova enquete aberta. Vote na aba Enquete.') }
  }, [p?.id, p?.status])

  const go = (i: number) => setView(i >= cur && !ended ? null : Math.max(0, i))
  const step = (d: number) => { const i = eff + d; if (canBrowse && i >= 0 && i <= last) go(i) }

  // ── fullscreen: CSS overlay everywhere (iPhone has no Fullscreen API), real fullscreen + landscape where supported ──
  const wake = () => { setAwake(true); clearTimeout(idle.current); idle.current = setTimeout(() => setAwake(false), 3500) }
  const enterFull = () => {
    setFull(true); wake()
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
    document.documentElement.requestFullscreen?.()?.then(() => o?.lock?.('landscape')).catch(() => {})
  }
  const exitFull = () => { setFull(false); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}) }
  useEffect(() => {
    const onFs = () => { if (!document.fullscreenElement) setFull(false) }
    document.addEventListener('fullscreenchange', onFs)
    return () => { document.removeEventListener('fullscreenchange', onFs); clearTimeout(idle.current) }
  }, [])
  useEffect(() => {
    document.body.style.overflow = full ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [full])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key.toLowerCase() === 'f') return full ? exitFull() : enterFull()
      if (!full) return
      wake()
      if (e.key === 'Escape') exitFull()
      else if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const react = (k: Kind) => {
    l.react(k)
    const id = Date.now() + Math.random()
    setPops(x => [...x.slice(-12), { id, kind: k, left: 8 + Math.random() * 84 }])
    setTimeout(() => setPops(x => x.filter(r => r.id !== id)), 2900)
  }
  const openPoll = () => { exitFull(); setTab('poll'); setTimeout(() => panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50) }

  const onNote = (body: string) => {
    setNotes(m => ({ ...m, [eff]: body }))
    setSaved(false)
    clearTimeout(timer.current)
    const slide = eff
    timer.current = setTimeout(async () => {
      const { error } = await supabase.from('notes').upsert({ session_id: sessionId, user_id: l.me, slide, body }, { onConflict: 'session_id,user_id,slide' })
      if (error) setToast('Não foi possível salvar a nota. Tentando de novo ao digitar.')
      else setSaved(true)
    }, 800)
  }
  const send = async () => {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    const err = await l.ask(text, anon)
    setSending(false)
    if (err) return setToast(err)
    setDraft('')
    setToast(s.moderation ? 'Pergunta enviada para a moderação.' : 'Pergunta publicada.')
  }

  const status = ended ? 'Reveja quando quiser' : following ? 'Acompanhando ao vivo' : `Palestrante no slide ${cur + 1}`
  const tabs: [typeof tab, string, IconName, ReactNode][] = [
    ['notas', 'Notas', 'edit', noted > 0 && <Badge>{noted}</Badge>],
    ['qa', 'Perguntas', 'message', qs.length > 0 && <Badge>{qs.length}</Badge>],
    ['poll', 'Enquete', 'poll', pollWaiting && <LiveDot />],
  ]

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-3 sm:px-6 lg:pt-6">
      <header className="glass sticky top-3 z-30 flex items-center gap-3 rounded-full py-1.5 pl-2 pr-1.5">
        {ended ? <Chip tone="gray">Encerrada</Chip> : <Chip tone="orange"><LiveDot />Ao vivo</Chip>}
        <h1 className="min-w-0 flex-1 truncate font-display text-sm font-semibold text-white sm:text-base">{deck.title}</h1>
        <span className="hidden font-mono text-xs text-emerald-100/55 sm:block">PIN {fmtPin(s.pin)}</span>
        {l.nickname
          ? <span title={l.nickname} className="liquid grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-300 to-orange-400 text-xs font-bold uppercase text-ink">{l.nickname.slice(0, 1)}</span>
          : <span className="font-mono text-xs text-emerald-100/55 sm:hidden">{fmtPin(s.pin)}</span>}
      </header>

      <div className="mt-4 grid gap-4 lg:mt-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-6">
        <section aria-label="Slides" className="flex min-w-0 flex-col gap-3">
          {/* stage: same element in both modes so the slide iframe never reloads */}
          <div onPointerMove={full ? wake : undefined} onPointerDown={full ? wake : undefined}
            onTouchStart={e => { touchX.current = e.touches[0].clientX }}
            onTouchEnd={e => { if (touchX.current === null) return; const dx = e.changedTouches[0].clientX - touchX.current; touchX.current = null; if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1) }}
            className={cx(full ? 'fixed inset-0 z-50 grid place-items-center bg-black' : 'glass relative rounded-[1.75rem] p-1.5', full && !awake && 'cursor-none')}>
            <div className={cx('relative w-full', !full && 'overflow-hidden rounded-[1.35rem] bg-black')} style={full ? { width: 'min(100vw, calc(100dvh * 16 / 9))' } : undefined}>
              <DeckSlide deck={deck} idx={eff} step={following ? s.current_step : Infinity} small={!full} />
              {!full && (
                <>
                  {!following && !ended && <span className="chameleon absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold">Revendo</span>}
                  <button onClick={enterFull} aria-label="Tela cheia" title="Tela cheia (F)"
                    className="chameleon absolute right-3 top-3 grid size-10 cursor-pointer place-items-center rounded-full transition hover:scale-105 active:scale-95">
                    <Icon name="expand" />
                  </button>
                </>
              )}
            </div>

            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
              {pops.map(r => (
                <span key={r.id} className={cx('liquid animate-rise absolute bottom-[8%] grid size-10 place-items-center rounded-full bg-gradient-to-b text-xl', R_BG[r.kind])} style={{ left: r.left + '%' }}>{EMOJI[r.kind]}</span>
              ))}
            </div>

            {full && (
              <div className={cx('pointer-events-none absolute inset-0 flex flex-col justify-between p-[max(1rem,env(safe-area-inset-top))] transition-opacity duration-300', awake ? 'opacity-100' : 'opacity-0')}>
                <div className="flex items-start gap-2">
                  <span className="chameleon inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">{ended ? 'Encerrada' : <><LiveDot />Ao vivo</>}</span>
                  <span className="chameleon hidden min-w-0 truncate rounded-full px-3 py-1 text-xs font-medium sm:block">{deck.title}</span>
                  {pollWaiting && <button onClick={openPoll} className={btn('accent', 'sm', cx('mx-auto', awake && 'pointer-events-auto'))}><Icon name="poll" className="size-4" />Enquete aberta · votar</button>}
                  <button onClick={exitFull} aria-label="Sair da tela cheia" title="Sair (Esc)"
                    className={cx('chameleon ml-auto grid size-11 cursor-pointer place-items-center rounded-full transition active:scale-95', awake && 'pointer-events-auto')}><Icon name="shrink" /></button>
                </div>
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div className="chameleon flex items-center gap-1 rounded-full p-1">
                    <button onClick={() => step(-1)} disabled={!canBrowse || eff === 0} aria-label="Slide anterior" className={cx('grid size-10 cursor-pointer place-items-center rounded-full transition hover:bg-white/15 disabled:opacity-30', awake && 'pointer-events-auto')}><Icon name="prev" /></button>
                    <span className="px-1 text-sm font-semibold tabular-nums">{eff + 1}<span className="opacity-60"> / {n}</span></span>
                    <button onClick={() => step(1)} disabled={!canBrowse || eff >= last} aria-label="Próximo slide" className={cx('grid size-10 cursor-pointer place-items-center rounded-full transition hover:bg-white/15 disabled:opacity-30', awake && 'pointer-events-auto')}><Icon name="next" /></button>
                  </div>
                  {!following && !ended && <button onClick={() => setView(null)} className={btn('accent', 'md', awake ? 'pointer-events-auto' : '')}>Voltar ao vivo · {cur + 1}</button>}
                  {!ended && (
                    <div className="chameleon flex gap-1 rounded-full p-1" aria-label="Reagir">
                      {KINDS.map(k => (
                        <button key={k} onClick={() => react(k)} aria-label={`Reagir ${k}`} className={cx('grid size-10 cursor-pointer place-items-center rounded-full text-xl transition hover:bg-white/15 active:scale-90', awake && 'pointer-events-auto')}>{EMOJI[k]}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="pane flex items-center gap-2 rounded-2xl p-2">
            <button onClick={() => step(-1)} disabled={!canBrowse || eff === 0} aria-label="Slide anterior" className={btn('ghost', 'md', 'size-11 rounded-xl px-0')}><Icon name="prev" /></button>
            <div className="min-w-0 flex-1 px-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold tabular-nums text-white">Slide {eff + 1}<span className="font-normal text-emerald-100/45"> de {n}</span></span>
                <span className="truncate text-xs text-emerald-100/55">{status}</span>
              </div>
              <div className="relative mt-2 h-1.5 rounded-full bg-white/8">
                <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-400 to-lime-300 transition-all duration-500" style={{ width: ((eff + 1) / n) * 100 + '%' }} />
                {!following && !ended && <span title={`Ao vivo: slide ${cur + 1}`} className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-400 ring-2 ring-ink" style={{ left: ((cur + 1) / n) * 100 + '%' }} />}
              </div>
            </div>
            <button onClick={() => step(1)} disabled={!canBrowse || eff >= last} aria-label="Próximo slide" className={btn('ghost', 'md', 'size-11 rounded-xl px-0')}><Icon name="next" /></button>
          </div>
          {!following && !ended && <button onClick={() => setView(null)} className={btn('accent', 'md', 'animate-fade-up')}><LiveDot />Voltar ao vivo · slide {cur + 1}</button>}
          {!canBrowse && <p className="-mt-1 text-center text-xs text-emerald-100/40">O palestrante controla os slides. Toque em <Icon name="expand" className="inline size-3.5 align-[-2px]" /> para tela cheia.</p>}

          {!ended && (
            <div className="pane flex items-center gap-3 rounded-2xl p-2 pl-4" aria-label="Reagir">
              <span className="text-sm font-medium text-emerald-100/70">Reaja ao vivo</span>
              <div className="ml-auto grid w-full max-w-[13.5rem] grid-cols-3 gap-2">
                {KINDS.map(k => (
                  <button key={k} onClick={() => react(k)} aria-label={`Reagir ${k}`}
                    className={cx('liquid h-12 cursor-pointer rounded-xl bg-gradient-to-b text-2xl transition hover:-translate-y-0.5 active:scale-90', R_BG[k])}>{EMOJI[k]}</button>
                ))}
              </div>
            </div>
          )}

          {ended && (
            <Link to={`/apostila/${sessionId}`} className="glass group flex items-center gap-4 rounded-3xl p-4 transition hover:-translate-y-0.5">
              <span className="liquid grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-b from-emerald-300 to-emerald-500 text-ink"><Icon name="book" className="size-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-display font-semibold text-white">Gerar apostila</span>
                <span className="block text-sm text-emerald-100/60">Slides com suas notas e as perguntas mais votadas</span>
              </span>
              <Icon name="arrow" className="text-emerald-100/50 transition group-hover:translate-x-1 group-hover:text-white" />
            </Link>
          )}
        </section>

        <aside ref={panel} aria-label="Participar" className="flex scroll-mt-20 flex-col gap-3 lg:sticky lg:top-24 lg:self-start">
          <div role="tablist" className="glass-soft grid grid-cols-3 gap-1 rounded-2xl p-1">
            {tabs.map(([k, label, icon, badge]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={cx('flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl text-sm font-medium transition',
                  tab === k ? 'liquid bg-gradient-to-b from-emerald-400/35 to-emerald-500/20 text-white' : 'text-emerald-100/60 hover:bg-white/5 hover:text-white')}>
                <Icon name={icon} className="size-4" /><span>{label}</span>{badge}
              </button>
            ))}
          </div>

          <section key={tab} role="tabpanel" className="pane animate-fade-up rounded-3xl p-4 sm:p-5">
            {tab === 'notas' && (
              <>
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="nota" className="font-display font-semibold text-white">Minhas notas</label>
                  <Chip tone={saved ? 'green' : 'gray'}>{saved ? <><Icon name="check" className="size-3" />Salvo</> : 'Salvando…'}</Chip>
                </div>
                <p className="mt-0.5 text-xs text-emerald-100/50">Slide {eff + 1} · só você vê</p>
                <textarea id="nota" value={notes[eff] ?? ''} onChange={e => onNote(e.target.value)} rows={7} maxLength={10000} placeholder="Anote o que quiser lembrar deste slide." className={cx(field, 'mt-3')} />
                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-emerald-100/50">
                  <span>{noted} {noted === 1 ? 'slide com nota' : 'slides com nota'}</span>
                  <Link to={`/apostila/${sessionId}`} className="inline-flex items-center gap-1 font-medium text-orange-300 hover:text-orange-200"><Icon name="book" className="size-3.5" />Gerar apostila</Link>
                </div>
              </>
            )}

            {tab === 'qa' && (
              <>
                {!ended && (
                  <form onSubmit={e => { e.preventDefault(); send() }}>
                    <label htmlFor="pergunta" className="font-display font-semibold text-white">Pergunte ao palestrante</label>
                    <textarea id="pergunta" value={draft} onChange={e => setDraft(e.target.value.slice(0, 280))} rows={3} placeholder={`Sua pergunta sobre o slide ${eff + 1}`} className={cx(field, 'mt-3')} />
                    <div className="mt-2.5 flex items-center gap-3">
                      <Check on={anon} onChange={setAnon} className="text-emerald-100/70">Anônima</Check>
                      <span className={cx('ml-auto text-xs tabular-nums', draft.length > 260 ? 'text-orange-300' : 'text-emerald-100/40')}>{draft.length}/280</span>
                      <button disabled={!draft.trim() || sending} className={btn('primary', 'md')}><Icon name="send" className="size-4" />{sending ? 'Enviando…' : 'Enviar'}</button>
                    </div>
                  </form>
                )}
                <ul className={cx('grid gap-2', !ended && 'mt-5 border-t border-white/8 pt-4')}>
                  {qs.map(q => {
                    const mine = l.myVotes.has(q.id)
                    return (
                      <li key={q.id} className={cx('flex gap-3 rounded-2xl border p-3 transition', q.pinned ? 'border-orange-300/40 bg-orange-400/10' : 'border-white/8 bg-white/[0.03]', q.answered && 'opacity-60')}>
                        <button onClick={() => l.vote(q.id)} disabled={q.status !== 'approved' || ended} aria-pressed={mine} aria-label={`${mine ? 'Remover voto' : 'Votar'}: ${q.upvote_count} votos`}
                          className={cx('flex h-14 w-12 shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl border text-sm font-bold tabular-nums transition active:scale-95 disabled:cursor-default',
                            mine ? 'liquid border-orange-300/60 bg-gradient-to-b from-orange-400 to-orange-600 text-ink' : 'border-white/10 bg-white/5 text-white hover:border-white/25')}>
                          <Icon name="up" className="size-4" />{q.upvote_count}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm leading-relaxed text-white">{q.text}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-emerald-100/50">
                            <span>{author(q)} · slide {q.slide + 1}</span>
                            {q.status === 'pending' && <Chip tone="gray">Aguardando moderação</Chip>}
                            {q.status === 'hidden' && <Chip tone="red">Não publicada</Chip>}
                            {q.answered && <Chip tone="green">Respondida</Chip>}
                            {q.pinned && <Chip tone="orange">No telão agora</Chip>}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                  {!qs.length && <li><Empty icon="message">Nenhuma pergunta ainda. Seja a primeira pessoa a perguntar.</Empty></li>}
                </ul>
              </>
            )}

            {tab === 'poll' && (p ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  {p.status === 'open' ? <Chip tone="orange"><LiveDot />Votação aberta</Chip> : <Chip tone="gray">Votação encerrada</Chip>}
                  <span className="text-xs tabular-nums text-emerald-100/50">{pTotal} {pTotal === 1 ? 'voto' : 'votos'}</span>
                </div>
                <p className="mt-3 font-display text-lg font-semibold leading-snug text-white">{p.question}</p>
                <ul className="mt-4 grid gap-2">
                  {p.options.map((o, i) => {
                    const pct = pTotal ? Math.round((p.counts[i] / pTotal) * 100) : 0
                    const letter = <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/8 font-mono text-xs font-bold text-emerald-200">{String.fromCharCode(65 + i)}</span>
                    return myOpt === undefined && p.status === 'open' ? (
                      <li key={i}>
                        <button onClick={() => l.votePoll(p.id, i)} className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 text-left text-sm font-medium text-white transition hover:border-emerald-300/50 hover:bg-emerald-400/10 active:scale-[0.98]">
                          {letter}{o}
                        </button>
                      </li>
                    ) : (
                      <li key={i} className={cx('relative overflow-hidden rounded-2xl border p-2.5', myOpt === i ? 'border-orange-300/45' : 'border-white/8')}>
                        <div className={cx('absolute inset-y-0 left-0 transition-all duration-700', myOpt === i ? 'bg-orange-400/20' : 'bg-emerald-400/12')} style={{ width: pct + '%' }} />
                        <div className="relative flex items-center gap-3 text-sm">
                          {letter}
                          <span className={cx('min-w-0 flex-1', myOpt === i ? 'font-semibold text-orange-100' : 'text-emerald-50')}>{o}</span>
                          {myOpt === i && <span className="text-xs text-orange-200">seu voto</span>}
                          <span className="w-10 text-right font-semibold tabular-nums text-white">{pct}%</span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </>
            ) : <Empty icon="poll">Nenhuma enquete agora. Quando o palestrante lançar uma, ela aparece aqui.</Empty>)}
          </section>
        </aside>
      </div>
      <Toast msg={toast} />
    </main>
  )
}

const Badge = ({ children }: { children: ReactNode }) => (
  <span className="min-w-5 rounded-full bg-white/12 px-1.5 text-[11px] font-semibold tabular-nums leading-5 text-white">{children}</span>
)

function Empty({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-white/5 text-emerald-200/70"><Icon name={icon} className="size-5" /></span>
      <span className="max-w-[16rem] text-sm text-emerald-100/55">{children}</span>
    </div>
  )
}
