import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { deleteDeck, fetchDeck, fmtPin, listSessions, minutes, type HtmlDeck, type SessionSummary } from '../decks'
import { DeckSlide } from '../HtmlSlide'
import { joinUrl } from '../live'
import { QR } from '../Slide'
import { Icon, PaneHead, Stat, Studio } from '../Studio'
import { supabase } from '../supabase'
import { ask, btn, Chip, cx, LiveDot, Switch } from '../ui'

const PRESETS = [15, 30, 45, 60, 90]
const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Hub of one presentation: plan its length, start or resume a session, open past reports, delete it. */
export default function Deck() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [deck, setDeck] = useState<HtmlDeck | null>(null)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [error, setError] = useState('')
  const [sel, setSel] = useState(0)
  const [dur, setDur] = useState(45)
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [freeNav, setFreeNav] = useState(true)
  const [moderation, setModeration] = useState(true)
  const [busy, setBusy] = useState(false)
  const saveT = useRef(0)

  useEffect(() => {
    Promise.all([fetchDeck(id), listSessions({ deck_id: id })])
      .then(([d, s]) => { setDeck(d); setDur(d.duration_min); setSessions(s) })
      .catch(e => setError(e.message ?? 'Apresentação não encontrada.'))
  }, [id])

  const setDuration = (m: number) => {
    const v = Math.max(1, Math.min(600, Math.round(m) || 1))
    setDur(v)
    setSaved('saving')
    clearTimeout(saveT.current)
    saveT.current = window.setTimeout(async () => {
      const { error } = await supabase.from('decks').update({ duration_min: v }).eq('id', id)
      if (error) { setError(error.message); setSaved('idle') } else setSaved('saved')
    }, 600)
  }

  const start = async () => {
    setBusy(true)
    const { data, error } = await supabase.rpc('create_session', { p_deck_id: id, p_free_nav: freeNav, p_moderation: moderation })
    setBusy(false)
    if (error) return setError(error.message)
    nav(`/presenter/${data.id}`)
  }
  const endLive = async (sid: string) => {
    if (!(await ask({ title: 'Encerrar a sessão ao vivo?', body: 'A plateia não poderá mais enviar perguntas nem reagir.', action: 'Encerrar sessão', tone: 'danger' }))) return
    const { error } = await supabase.from('sessions').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', sid)
    if (error) return setError(error.message)
    setSessions(await listSessions({ deck_id: id }))
  }
  const remove = async () => {
    if (!deck || !(await ask({ title: `Excluir "${deck.title}"?`, body: 'Slides, sessões e relatórios serão apagados para sempre. Não dá para desfazer.', action: 'Excluir apresentação', tone: 'danger', icon: 'trash' }))) return
    setBusy(true)
    try { await deleteDeck(id); nav('/upload') } catch (e) { setError((e as Error).message); setBusy(false) }
  }

  if (!deck) return (
    <Studio title={error ? 'Apresentação não encontrada' : 'Carregando…'} kicker={<Link to="/upload" className="hover:text-white">← Biblioteca</Link>}>
      {error ? <p className="text-rose-300">{error}</p> : <div className="pane h-80 animate-pulse rounded-3xl" />}
    </Studio>
  )

  const n = deck.slides.length
  const live = sessions.find(s => s.status === 'live')
  const ended = sessions.filter(s => s.status === 'ended')
  const audience = sessions.reduce((a, s) => a + (s.participants[0]?.count ?? 0), 0)
  const avg = ended.length ? Math.round(ended.reduce((a, s) => a + minutes(s), 0) / ended.length) : null
  const perSlide = (dur * 60) / Math.max(1, n)

  return (
    <Studio
      kicker={<><Link to="/upload" className="hover:text-white">← Biblioteca</Link><span aria-hidden>·</span><span>{n} slides</span>{live && <Chip tone="orange"><LiveDot /> Ao vivo agora</Chip>}</>}
      title={deck.title}
      actions={live
        ? <Link to={`/presenter/${live.id}`} className={btn('accent', 'md')}><Icon name="live" /> Voltar ao console</Link>
        : <button onClick={start} disabled={busy} className={btn('primary', 'md')}><Icon name="live" /> Iniciar sessão ao vivo</button>}
    >
      {error && <p role="alert" className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat accent label="Duração prevista" icon="clock" value={`${dur} min`} hint={`≈ ${Math.floor(perSlide / 60)}:${String(Math.round(perSlide % 60)).padStart(2, '0')} por slide`} />
        <Stat label="Slides" icon="file" value={n} hint={`${deck.slides.filter(s => s.notes).length} com notas do orador`} />
        <Stat label="Sessões" icon="chart" value={sessions.length} hint={avg ? `média real ${avg} min` : 'nenhuma encerrada ainda'} />
        <Stat label="Público total" icon="users" value={audience} hint="somando todas as sessões" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 gap-4">
          <section className="pane rounded-3xl p-4 sm:p-5">
            <PaneHead title="Slides" sub={`Slide ${sel + 1} de ${n} · ${deck.slides[sel]?.title || 'Sem título'}`} />
            <DeckSlide deck={deck} idx={sel} step={Infinity} className="mt-4 overflow-hidden rounded-2xl ring-1 ring-white/10" />
            <div className="mt-3 rounded-2xl bg-black/20 p-3.5">
              <div className="text-xs font-semibold uppercase tracking-wider text-emerald-200/60">Notas do orador</div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-emerald-50/85">{deck.slides[sel]?.notes || 'Sem notas neste slide.'}</p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
              {deck.slides.map((_, i) => (
                <button key={i} onClick={() => setSel(i)} aria-label={`Ver slide ${i + 1}`} aria-pressed={i === sel}
                  className={cx('relative cursor-pointer overflow-hidden rounded-xl ring-2 transition hover:-translate-y-0.5', i === sel ? 'ring-orange-400' : 'ring-transparent hover:ring-white/25')}>
                  <DeckSlide deck={deck} idx={i} step={Infinity} small className="pointer-events-none" />
                  <span className="absolute bottom-1 left-1 rounded-md bg-black/60 px-1.5 font-mono text-[10px] text-white">{i + 1}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="pane rounded-3xl p-4 sm:p-5">
            <PaneHead title="Sessões e relatórios" sub="Cada vez que você apresentou este material" />
            {sessions.length === 0
              ? <p className="mt-4 rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-emerald-100/60">Nenhuma sessão ainda. Defina a duração e inicie a primeira.</p>
              : <ul className="mt-4 divide-y divide-white/8">
                {sessions.map(s => {
                  const m = minutes(s), over = s.status === 'ended' && m > dur * 1.1
                  return (
                    <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm font-medium text-white">
                          {when(s.started_at)} {s.status === 'live' ? <Chip tone="orange">Ao vivo</Chip> : <Chip tone="green">Encerrada</Chip>}
                        </div>
                        <div className="mt-0.5 text-xs text-emerald-100/55">
                          <span className={cx(over && 'text-orange-300')}>{m} de {dur} min</span> · {s.participants[0]?.count ?? 0} pessoas · {s.questions[0]?.count ?? 0} perguntas · PIN {fmtPin(s.pin)}
                        </div>
                      </div>
                      {s.status === 'live' && <Link to={`/presenter/${s.id}`} className={btn('accent', 'sm')}>Console</Link>}
                      <Link to={`/relatorio/${s.id}`} className={btn('ghost', 'sm')}><Icon name="chart" className="size-4" /> Relatório</Link>
                    </li>
                  )
                })}
              </ul>}
          </section>
        </div>

        <aside className="grid content-start gap-4">
          {live ? (
            <section className="glass rounded-3xl p-5">
              <PaneHead title="Sessão ao vivo" sub={`Começou ${when(live.started_at)}`} aside={<LiveDot />} />
              <div className="mt-4 flex items-center gap-4">
                <QR value={joinUrl(live.pin)} className="w-32 shrink-0" />
                <div>
                  <div className="text-xs uppercase tracking-wider text-emerald-100/55">PIN</div>
                  <div className="font-mono text-3xl font-bold tracking-wider text-white">{fmtPin(live.pin)}</div>
                  <div className="mt-1 text-xs text-emerald-100/55">{live.participants[0]?.count ?? 0} pessoas entraram</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link to={`/presenter/${live.id}`} className={btn('accent', 'md')}><Icon name="live" /> Console</Link>
                <a href={`/stage/${live.id}`} target="_blank" rel="noreferrer" className={btn('ghost', 'md')}><Icon name="screen" /> Telão</a>
                <button onClick={() => endLive(live.id)} className={btn('danger', 'md', 'col-span-2')}>Encerrar sessão</button>
              </div>
            </section>
          ) : (
            <section className="glass rounded-3xl p-5">
              <PaneHead title="Iniciar sessão" sub="Gera um PIN e um QR code para a plateia" />
              <div className="mt-3 grid gap-1">
                <Switch on={freeNav} onChange={() => setFreeNav(v => !v)} label="Navegação livre" hint="Plateia revê slides que já passaram" />
                <Switch on={moderation} onChange={() => setModeration(v => !v)} label="Moderar perguntas" hint="Você aprova antes de aparecerem" />
              </div>
              <button onClick={start} disabled={busy} className={btn('primary', 'lg', 'mt-4 w-full')}><Icon name="live" /> {busy ? 'Criando sala…' : 'Iniciar sessão ao vivo'}</button>
            </section>
          )}

          <section className="pane rounded-3xl p-5">
            <PaneHead title="Duração prevista" sub="Usada no cronômetro do console e no relatório"
              aside={<span aria-live="polite" className="text-xs text-emerald-200/70">{saved === 'saving' ? 'Salvando…' : saved === 'saved' ? '✓ Salvo' : ''}</span>} />
            <div className="mt-4 flex items-end gap-3">
              <label className="sr-only" htmlFor="dur">Minutos</label>
              <input id="dur" type="number" min={1} max={600} value={dur} onChange={e => setDuration(+e.target.value)}
                className="w-24 rounded-2xl border border-white/12 bg-black/25 px-3 py-2 font-display text-3xl font-bold text-white tabular-nums outline-none focus:border-emerald-300" />
              <span className="pb-2 text-emerald-100/60">minutos</span>
            </div>
            <input type="range" min={5} max={180} step={5} value={Math.min(180, dur)} onChange={e => setDuration(+e.target.value)}
              aria-label="Duração em minutos" className="mt-4 w-full" style={{ '--fill': `${((Math.min(180, dur) - 5) / 175) * 100}%` } as CSSProperties} />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {PRESETS.map(p => (
                <button key={p} onClick={() => setDuration(p)} aria-pressed={dur === p}
                  className={cx('min-h-9 cursor-pointer rounded-full px-3.5 text-xs font-semibold transition', dur === p ? 'liquid bg-gradient-to-b from-emerald-300 to-emerald-500 text-ink' : 'glass-soft text-emerald-100/75 hover:text-white')}>
                  {p} min
                </button>
              ))}
            </div>
            {avg && <p className="mt-3 text-xs text-emerald-100/55">Nas sessões anteriores você levou em média <b className="text-white">{avg} min</b>.</p>}
          </section>

          <section className="pane rounded-3xl p-5">
            <PaneHead title="Mais opções" />
            <div className="mt-3 grid gap-2">
              {live && <a href={`/watch/${live.id}`} target="_blank" rel="noreferrer" className={btn('ghost', 'md', 'justify-start')}><Icon name="eye" /> Ver como a plateia</a>}
              {ended[0] && <Link to={`/relatorio/${ended[0].id}`} className={btn('ghost', 'md', 'justify-start')}><Icon name="chart" /> Último relatório</Link>}
              <button onClick={remove} disabled={busy} className={btn('danger', 'md', 'justify-start')}><Icon name="x" /> Excluir apresentação</button>
            </div>
          </section>
        </aside>
      </div>
    </Studio>
  )
}
