import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useSession } from '../Auth'
import { fmtPin, listDecks, listSessions, minutes, uploadPdf, type DeckListItem, type SessionSummary } from '../decks'
import { DeckSlide } from '../HtmlSlide'
import { Icon, PaneHead, Stat, Studio } from '../Studio'
import { btn, Chip, cx, LiveDot } from '../ui'

const when = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

/** Library: upload a PDF, browse decks (each opens its detail hub), recent sessions. */
export default function Upload() {
  const user = useSession()?.user
  const first = (user?.user_metadata.full_name as string | undefined)?.split(' ')[0]
  const nav = useNavigate()
  const [decks, setDecks] = useState<DeckListItem[] | null>(null)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [query, setQuery] = useState('')
  const [up, setUp] = useState<{ name: string; done: number; total: number } | null>(null)
  const [error, setError] = useState('')
  const [drag, setDrag] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const uid = user?.id

  useEffect(() => {
    if (!uid) return
    Promise.all([listDecks(uid), listSessions({ owner_id: uid })])
      .then(([d, s]) => { setDecks(d); setSessions(s) })
      .catch(e => setError(e.message))
  }, [uid])

  const send = async (file?: File) => {
    if (!file || up) return
    setError('')
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf')
      return setError('Envie um PDF. No PowerPoint ou Keynote: Arquivo → Exportar → PDF.')
    setUp({ name: file.name, done: 0, total: 0 })
    try {
      const id = await uploadPdf(file, (done, total) => setUp({ name: file.name, done, total }))
      nav(`/deck/${id}`)
    } catch (e) {
      setError((e as Error).message)
      setUp(null)
      if (uid) listDecks(uid).then(setDecks)
    }
  }

  const live = sessions.find(s => s.status === 'live')
  const people = sessions.reduce((a, s) => a + (s.participants[0]?.count ?? 0), 0)
  const qs = sessions.reduce((a, s) => a + (s.questions[0]?.count ?? 0), 0)
  const shown = (decks ?? []).filter(d => d.title.toLowerCase().includes(query.trim().toLowerCase()))
  const pct = up?.total ? Math.round((up.done / up.total) * 100) : 0
  const oldest = sessions.at(-1)

  return (
    <Studio
      kicker={first ? <>Olá, {first}</> : 'Estúdio'}
      title="Suas apresentações"
      sub="Envie um PDF. Depois abra a apresentação para planejar o tempo, entrar ao vivo e ver os relatórios."
      actions={live && <Link to={`/presenter/${live.id}`} className={btn('accent', 'md')}><LiveDot />Ao vivo · PIN {fmtPin(live.pin)}</Link>}
    >
      {error && <p role="alert" className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat accent label="Pessoas alcançadas" icon="users" value={people} hint={`em ${sessions.length} sessões`} />
        <Stat label="Sessões realizadas" icon="live" value={sessions.length} hint={oldest ? `desde ${when(oldest.started_at)}` : 'nenhuma ainda'} />
        <Stat label="Perguntas recebidas" icon="message" value={qs} hint={sessions.length ? `média de ${Math.round(qs / sessions.length)} por sessão` : '—'} />
        <Stat label="Apresentações" icon="library" value={decks?.length ?? '—'} hint={`${(decks ?? []).filter(d => d.status === 'ready').length} prontas para o palco`} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-label="Enviar apresentação" className="pane rounded-[2rem] p-5 sm:p-6">
          <PaneHead title="Nova apresentação" sub="Convertida no seu navegador, página a página" />
          {!up ? (
            <div onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); send(e.dataTransfer.files[0]) }}
              className={cx('mt-5 flex flex-col items-center rounded-3xl border-2 border-dashed px-6 py-10 text-center transition duration-200',
                drag ? 'border-orange-300/70 bg-orange-400/10' : 'border-emerald-300/20 bg-emerald-400/[0.03] hover:border-orange-300/45 hover:bg-orange-400/[0.04]')}>
              <div className="liquid grid size-14 place-items-center rounded-2xl bg-gradient-to-b from-emerald-300 to-emerald-500 text-ink"><Icon name="upload" className="size-6" /></div>
              <div className="mt-4 font-display text-lg font-semibold text-white">Arraste o PDF aqui</div>
              <p className="mt-1 max-w-lg text-pretty text-sm text-emerald-100/60">Fontes e layout chegam exatamente como no seu computador. Usa PowerPoint ou Keynote? Exporte como PDF antes.</p>
              <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" tabIndex={-1} onChange={e => send(e.target.files?.[0])} />
              <button onClick={() => input.current?.click()} className={btn('primary', 'md', 'mt-5')}>Escolher PDF</button>
            </div>
          ) : (
            <div className="animate-fade-up mt-5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 font-mono text-emerald-50"><Icon name="file" className="size-4 text-emerald-300" /><span className="truncate">{up.name}</span></span>
                <span className="font-semibold tabular-nums text-orange-300">{up.total ? `${up.done}/${up.total} páginas` : 'Lendo PDF…'}</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/8" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da conversão">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-lime-300 to-orange-400 transition-[width] duration-300" style={{ width: pct + '%' }} />
              </div>
              <p className="mt-3 text-sm text-emerald-100/60">Gerando imagens 1920×1080 para o telão e 1280×720 para celular. Não feche esta aba.</p>
            </div>
          )}
        </section>

        <section aria-label="Últimas sessões" className="pane flex flex-col rounded-[2rem] p-5">
          <PaneHead title="Últimas sessões" aside={sessions.length > 0 && <Link to="/relatorio" className="text-sm font-medium text-orange-300 hover:text-orange-200">Ver todas</Link>} />
          {sessions.length === 0 && <p className="mt-4 text-sm text-emerald-100/55">Seus relatórios aparecem aqui depois da primeira sessão.</p>}
          <ul className="mt-3 divide-y divide-white/8">
            {sessions.slice(0, 4).map(s => (
              <li key={s.id}>
                <Link to={s.status === 'live' ? `/presenter/${s.id}` : `/relatorio/${s.id}`} className="group -mx-2 flex items-center gap-3 rounded-2xl px-2 py-3 transition hover:bg-white/5">
                  <span className={cx('grid size-10 shrink-0 place-items-center rounded-xl', s.status === 'live' ? 'bg-orange-400/15 text-orange-300' : 'bg-white/6 text-emerald-200')}><Icon name={s.status === 'live' ? 'live' : 'chart'} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">{s.decks?.title ?? 'Apresentação'}</span>
                    <span className="block text-xs tabular-nums text-emerald-100/50">{s.status === 'live' ? 'Ao vivo agora' : `${when(s.started_at)} · ${minutes(s)} min`} · {s.participants[0]?.count ?? 0} pessoas · {s.questions[0]?.count ?? 0} perguntas</span>
                  </span>
                  <Icon name="next" className="size-4 text-emerald-100/40 transition group-hover:translate-x-0.5 group-hover:text-white" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-label="Biblioteca" className="mt-10">
        <PaneHead title="Biblioteca" sub={decks ? `${decks.length} apresentações` : 'Carregando…'} aside={
          <label className="glass-soft flex h-11 w-full items-center gap-2 rounded-full px-4 text-emerald-100/60 focus-within:ring-2 focus-within:ring-orange-400/60 sm:w-72">
            <Icon name="search" className="size-4" />
            <span className="sr-only">Buscar apresentação</span>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar apresentação" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-emerald-100/40" />
          </label>
        } />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {!decks && !error && [0, 1, 2].map(i => <div key={i} className="pane aspect-[4/3] animate-pulse rounded-3xl" />)}
          {shown.map(d => {
            const isLive = d.sessions.some((s: { status: string }) => s.status === 'live')
            return (
              <Link key={d.id} to={`/deck/${d.id}`} className="pane group animate-fade-up flex flex-col rounded-3xl p-3 transition duration-200 hover:-translate-y-0.5 hover:border-white/20">
                <div className="overflow-hidden rounded-2xl ring-1 ring-white/10">
                  {d.slides[0] ? <DeckSlide deck={d} idx={0} small className="pointer-events-none" /> : <div className="grid aspect-video place-items-center bg-black/30 text-sm text-emerald-100/50">Sem prévia</div>}
                </div>
                <div className="flex items-start justify-between gap-2 px-2 pt-4">
                  <h3 className="font-display font-semibold leading-snug text-white">{d.title}</h3>
                  {isLive ? <Chip tone="orange" className="shrink-0"><LiveDot />Ao vivo</Chip>
                    : d.status === 'ready' ? <Chip tone="green" className="shrink-0">Pronta</Chip>
                    : d.status === 'error' ? <Chip tone="red" className="shrink-0">Falhou</Chip>
                    : <Chip tone="orange" className="shrink-0">Processando</Chip>}
                </div>
                <div className="flex items-center justify-between gap-2 px-2 pb-1 pt-1 text-sm text-emerald-100/55">
                  <span>{d.slide_count} slides · {d.duration_min} min · {d.sessions.length} sessões</span>
                  <Icon name="next" className="size-4 shrink-0 transition group-hover:translate-x-0.5 group-hover:text-white" />
                </div>
              </Link>
            )
          })}
          {decks && !shown.length && <p className="col-span-full py-10 text-center text-sm text-emerald-100/50">{query ? `Nenhuma apresentação com “${query}”.` : 'Nenhuma apresentação ainda. Envie o primeiro PDF.'}</p>}
        </div>
      </section>
    </Studio>
  )
}
