import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { fmtPin } from '../decks'
import { DeckSlide } from '../HtmlSlide'
import { author, byRank, useLive } from '../live'
import { EMOJI, R_BG, type Kind } from '../room'
import { supabase } from '../supabase'
import { Icon } from '../Studio'
import { Bar, btn, Check, Chip, cx, LiveDot, Toast } from '../ui'

/** `/watch/:sessionId`: what the audience sees on their phone. */
export default function Watch() {
  const { sessionId = '' } = useParams()
  const l = useLive(sessionId, 'audience')
  const { session: s, deck } = l
  const [view, setView] = useState<number | null>(null) // null = follow the presenter
  const [tab, setTab] = useState<'notas' | 'qa' | 'poll'>('notas')
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [saved, setSaved] = useState(true)
  const [draft, setDraft] = useState('')
  const [anon, setAnon] = useState(false)
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    supabase.from('notes').select('slide, body').eq('session_id', sessionId)
      .then(({ data }) => setNotes(Object.fromEntries((data ?? []).map(n => [n.slide, n.body]))))
  }, [sessionId])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2600); return () => clearTimeout(t) }, [toast])

  if (!s || !deck) return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <p className="text-emerald-100/70">{l.error ?? 'Entrando na sala…'}</p>
        {l.error && <Link to="/join" className={btn('primary', 'md', 'mt-4')}>Digitar o PIN</Link>}
      </div>
    </main>
  )

  const cur = s.current_slide, n = deck.slides.length
  const ended = s.status === 'ended'
  const canBrowse = s.free_nav || ended
  const eff = canBrowse && view !== null ? Math.min(view, ended ? n - 1 : cur) : cur
  const following = eff === cur && view === null

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

  const qs = [...l.questions].filter(q => q.status === 'approved' || q.author_id === l.me).sort(byRank)
  const p = l.poll && l.poll.status !== 'idle' ? l.poll : null
  const myOpt = p ? l.myPoll[p.id] : undefined
  const pTotal = p ? p.counts.reduce((a, b) => a + b, 0) : 0
  const go = (i: number) => setView(i >= cur && !ended ? null : Math.max(0, i))

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-3 px-4 pb-6 pt-4">
      <header className="flex items-center justify-between gap-2 text-xs">
        {ended ? <Chip tone="gray">Sessão encerrada</Chip> : <Chip tone="orange"><LiveDot />Ao vivo</Chip>}
        <span className="font-mono text-emerald-100/55">PIN {fmtPin(s.pin)}{l.nickname && ` · ${l.nickname}`}</span>
      </header>
      <h1 className="font-display text-lg font-semibold leading-tight text-white">{deck.title}</h1>

      <DeckSlide deck={deck} idx={eff} step={following ? s.current_step : Infinity} small className="overflow-hidden rounded-2xl ring-1 ring-white/10" />

      <div className="flex items-center justify-between gap-2">
        <button onClick={() => go(eff - 1)} disabled={!canBrowse || eff === 0} aria-label="Slide anterior" className={btn('ghost', 'md', 'size-11 px-0')}><Icon name="prev" /></button>
        <div className="text-center text-sm">
          <div className="font-semibold tabular-nums text-white">Slide {eff + 1} de {n}</div>
          <div className="text-xs text-emerald-100/50">{ended ? 'Reveja quando quiser' : following ? 'Acompanhando ao vivo' : `Revendo · o palestrante está no ${cur + 1}`}</div>
        </div>
        <button onClick={() => go(eff + 1)} disabled={!canBrowse || eff >= (ended ? n - 1 : cur)} aria-label="Próximo slide" className={btn('ghost', 'md', 'size-11 px-0')}><Icon name="next" /></button>
      </div>
      {!following && !ended && <button onClick={() => setView(null)} className={btn('accent', 'md')}>Voltar ao vivo · slide {cur + 1}</button>}

      {ended && (
        <Link to={`/apostila/${sessionId}`} className="glass flex items-center gap-3 rounded-2xl p-4 transition hover:-translate-y-0.5">
          <span className="liquid grid size-11 place-items-center rounded-xl bg-gradient-to-b from-emerald-300 to-emerald-500 text-ink"><Icon name="book" /></span>
          <span className="flex-1"><span className="block font-semibold text-white">Gerar apostila</span><span className="text-sm text-emerald-100/60">Slides com suas notas e as perguntas mais votadas</span></span>
          <Icon name="next" className="text-emerald-100/50" />
        </Link>
      )}

      <div role="tablist" aria-label="Participar" className="glass-soft grid grid-cols-3 gap-1 rounded-2xl p-1">
        {([['notas', 'Notas'], ['qa', `Perguntas ${qs.length || ''}`], ['poll', p?.status === 'open' ? 'Enquete •' : 'Enquete']] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cx('h-10 cursor-pointer rounded-xl text-sm font-medium transition', tab === k ? 'liquid bg-emerald-400/25 text-white' : 'text-emerald-100/60 hover:text-white')}>{label}</button>
        ))}
      </div>

      <section role="tabpanel" className="pane rounded-3xl p-4">
        {tab === 'notas' && (
          <>
            <label htmlFor="nota" className="flex justify-between text-sm font-medium text-white">
              Minhas notas · slide {eff + 1}<span className="text-xs font-normal text-emerald-100/50">{saved ? '✓ Salvo' : 'Salvando…'}</span>
            </label>
            <textarea id="nota" value={notes[eff] ?? ''} onChange={e => onNote(e.target.value)} rows={5} maxLength={10000} placeholder="Anote o que quiser lembrar deste slide."
              className="mt-2 w-full resize-none rounded-2xl border border-white/12 bg-black/25 p-3 text-sm text-white outline-none placeholder:text-emerald-100/35 focus:border-emerald-300" />
            <p className="mt-2 text-xs text-emerald-100/50">{Object.values(notes).filter(Boolean).length} slides com nota · <Link to={`/apostila/${sessionId}`} className="text-orange-300 hover:text-orange-200">gerar apostila</Link></p>
          </>
        )}

        {tab === 'qa' && (
          <>
            {!ended && (
              <form onSubmit={e => { e.preventDefault(); send() }}>
                <label htmlFor="pergunta" className="text-sm font-medium text-white">Pergunte ao palestrante</label>
                <textarea id="pergunta" value={draft} onChange={e => setDraft(e.target.value.slice(0, 280))} rows={3} placeholder="Sua pergunta sobre este slide"
                  className="mt-2 w-full resize-none rounded-2xl border border-white/12 bg-black/25 p-3 text-sm text-white outline-none placeholder:text-emerald-100/35 focus:border-emerald-300" />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <Check on={anon} onChange={setAnon} className="text-emerald-100/70">Anônima</Check>
                  <span className="ml-auto text-xs tabular-nums text-emerald-100/40">{draft.length}/280</span>
                  <button disabled={!draft.trim() || sending} className={btn('primary', 'sm')}>Enviar</button>
                </div>
              </form>
            )}
            <ul className="mt-4 grid gap-2">
              {qs.map(q => {
                const mine = l.myVotes.has(q.id)
                return (
                  <li key={q.id} className={cx('flex gap-3 rounded-2xl border p-3', q.pinned ? 'border-orange-300/40 bg-orange-400/10' : 'border-white/8 bg-white/[0.03]')}>
                    <button onClick={() => l.vote(q.id)} disabled={q.status !== 'approved' || ended} aria-pressed={mine} aria-label={`Votar: ${q.upvote_count} votos`}
                      className={cx('grid h-12 w-11 shrink-0 cursor-pointer place-items-center rounded-xl border text-sm font-bold tabular-nums transition disabled:cursor-default',
                        mine ? 'border-orange-300/60 bg-orange-400/20 text-orange-200' : 'border-white/10 bg-white/5 text-white hover:border-white/25')}>▲<span className="-mt-1">{q.upvote_count}</span></button>
                    <div className="min-w-0">
                      <p className="text-sm text-white">{q.text}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-emerald-100/50">
                        {author(q)} · slide {q.slide + 1}
                        {q.status === 'pending' && <Chip tone="gray">Aguardando moderação</Chip>}
                        {q.status === 'hidden' && <Chip tone="red">Não publicada</Chip>}
                        {q.answered && <Chip tone="green">Respondida</Chip>}
                        {q.pinned && <Chip tone="orange">No telão agora</Chip>}
                      </div>
                    </div>
                  </li>
                )
              })}
              {!qs.length && <li className="py-4 text-center text-sm text-emerald-100/50">Nenhuma pergunta ainda. Seja a primeira pessoa a perguntar.</li>}
            </ul>
          </>
        )}

        {tab === 'poll' && (p ? (
          <>
            <p className="font-medium text-white">{p.question}</p>
            <ul className="mt-3 grid gap-2">
              {p.options.map((o, i) => {
                const pct = pTotal ? Math.round((p.counts[i] / pTotal) * 100) : 0
                return myOpt === undefined && p.status === 'open' ? (
                  <li key={i}><button onClick={() => l.votePoll(p.id, i)} className={btn('ghost', 'md', 'w-full justify-start')}>{o}</button></li>
                ) : (
                  <li key={i}>
                    <div className="flex justify-between text-sm"><span className={myOpt === i ? 'font-semibold text-orange-200' : 'text-emerald-50'}>{o}{myOpt === i && ' · seu voto'}</span><span className="tabular-nums text-emerald-100/60">{pct}%</span></div>
                    <Bar pct={pct} mine={myOpt === i} />
                  </li>
                )
              })}
            </ul>
            <p className="mt-2 text-xs text-emerald-100/50">{p.status === 'open' ? 'Votação aberta' : 'Votação encerrada'} · {pTotal} votos</p>
          </>
        ) : <p className="py-4 text-center text-sm text-emerald-100/50">Nenhuma enquete agora. Quando o palestrante lançar uma, ela aparece aqui.</p>)}
      </section>

      {!ended && (
        <div className="grid grid-cols-3 gap-2" aria-label="Reagir">
          {(Object.keys(EMOJI) as Kind[]).map(k => (
            <button key={k} onClick={() => l.react(k)} aria-label={`Reagir ${k}`}
              className={cx('liquid h-14 cursor-pointer rounded-2xl text-2xl transition active:scale-95', R_BG[k])}>{EMOJI[k]}</button>
          ))}
        </div>
      )}
      <Toast msg={toast} />
    </main>
  )
}
