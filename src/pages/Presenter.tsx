import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { useSession } from '../Auth'
import { fmtPin, listSessions } from '../decks'
import { DeckSlide } from '../HtmlSlide'
import { author, byRank, clock, joinUrl, stageExtras, useDeckKeys, useLive, useNow, type Live, type QRow } from '../live'
import { EMOJI, StageView } from '../room'
import { Icon, PaneHead, Stat, Studio } from '../Studio'
import { ask, Bar, btn, Chip, cx, LiveDot, Segmented, Switch } from '../ui'

/** `/presenter` jumps to the owner's live session; `/presenter/:sessionId` is the console. */
export default function Presenter() {
  const { sessionId } = useParams()
  const uid = useSession()?.user.id
  const [liveId, setLiveId] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    if (sessionId || !uid) return
    listSessions({ owner_id: uid }).then(s => setLiveId(s.find(x => x.status === 'live')?.id ?? null), () => setLiveId(null))
  }, [sessionId, uid])

  if (sessionId) return <Console key={sessionId} id={sessionId} />
  if (liveId) return <Navigate to={`/presenter/${liveId}`} replace />
  return (
    <Studio title={liveId === null ? 'Nenhuma sessão ao vivo' : 'Procurando sessão…'} sub={liveId === null ? 'Abra uma apresentação na biblioteca, defina a duração e inicie a sessão.' : undefined}
      actions={<Link to="/upload" className={btn('primary', 'md')}><Icon name="library" /> Ir para a biblioteca</Link>}>
      <div className="pane grid h-64 place-items-center rounded-3xl text-emerald-100/50"><Icon name="live" className="size-10" /></div>
    </Studio>
  )
}

function Console({ id }: { id: string }) {
  const l = useLive(id, 'host')
  useDeckKeys(l)
  const now = useNow()
  const nav = useNavigate()
  const [tab, setTab] = useState<'fila' | 'mod' | 'poll'>('fila')
  const { session: s, deck } = l

  if (!s || !deck) return (
    <Studio title={l.error ? 'Sessão indisponível' : 'Abrindo console…'} kicker={<Link to="/upload" className="hover:text-white">← Biblioteca</Link>}>
      {l.error ? <p className="text-rose-300">{l.error}</p> : <div className="pane h-96 animate-pulse rounded-3xl" />}
    </Studio>
  )
  if (s.status === 'ended') return <Navigate to={`/relatorio/${id}`} replace />

  const n = deck.slides.length, cur = s.current_slide, steps = l.steps[cur] ?? 0
  const elapsed = (now - Date.parse(s.started_at)) / 1000, planned = deck.duration_min * 60
  const frac = elapsed / planned, over = elapsed > planned
  const expected = Math.min(n - 1, Math.floor(frac * n))
  const approved = l.questions.filter(q => q.status === 'approved')
  const pending = l.questions.filter(q => q.status === 'pending')
  const hidden = l.questions.filter(q => q.status === 'hidden' || q.status === 'merged')
  const queue = [...approved].sort(byRank)
  const hot = queue.find(q => !q.answered && !q.pinned && q.upvote_count >= 5)
  const reactions = Object.values(l.totals).reduce((a, b) => a + b, 0)
  const end = async () => {
    if (!(await ask({ title: 'Encerrar a sessão?', body: 'A plateia deixa de enviar perguntas e reações. O relatório fica disponível em seguida.', action: 'Encerrar e ver relatório', tone: 'danger' }))) return
    if (await l.end()) nav(`/relatorio/${id}`)
  }

  return (
    <Studio
      kicker={<><Chip tone="orange"><LiveDot />Ao vivo · {clock(elapsed)}</Chip><span>PIN <b className="font-mono text-white">{fmtPin(s.pin)}</b></span><Link to={`/deck/${deck.id}`} className="hover:text-white">Detalhes da apresentação</Link></>}
      title={deck.title}
      actions={<>
        <a href={`/stage/${id}`} target="_blank" rel="noreferrer" className={btn('ghost', 'md')}><Icon name="screen" />Abrir telão</a>
        <button onClick={end} className={btn('danger', 'md')}>Encerrar sessão</button>
      </>}
    >
      {l.error && <p role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{l.error}<button onClick={() => l.setError(null)} aria-label="Fechar aviso" className="cursor-pointer"><Icon name="x" className="size-4" /></button></p>}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat accent label="Tempo de fala" icon="clock" value={clock(elapsed)}
          hint={over ? `${clock(elapsed - planned)} acima dos ${deck.duration_min} min previstos` : `${clock(planned - elapsed)} restantes de ${deck.duration_min} min`}>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/25">
            <div className={cx('h-full rounded-full transition-[width] duration-1000', frac > 0.85 ? 'bg-orange-300' : 'bg-white/85')} style={{ width: Math.min(100, frac * 100) + '%' }} />
          </div>
          <div className="mt-2 text-xs text-emerald-50/80">{cur === expected ? 'No ritmo previsto' : cur < expected ? `Atrasado: o plano previa o slide ${expected + 1}` : `Adiantado: o plano previa o slide ${expected + 1}`}</div>
        </Stat>
        <Stat label="Público agora" icon="users" value={l.online} hint="celulares conectados" />
        <Stat label="Perguntas" icon="message" value={approved.length} hint={pending.length ? `${pending.length} aguardando moderação` : 'nenhuma pendente'} />
        <Stat label="Reações" icon="flame" value={reactions} hint={(Object.keys(EMOJI) as (keyof typeof EMOJI)[]).map(k => `${EMOJI[k]} ${l.totals[k]}`).join('  ')} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid min-w-0 content-start gap-4">
          <section className="pane rounded-3xl p-4 sm:p-5">
            <PaneHead title="No telão" sub={`Slide ${cur + 1} de ${n}${steps ? ` · clique ${s.current_step} de ${steps}` : ''}`}
              aside={<button onClick={l.toggleQr} aria-pressed={l.showQr} className={btn(l.showQr ? 'accent' : 'ghost', 'sm')}><Icon name="qr" className="size-4" />QR code</button>} />
            <StageView className="mt-4 ring-1 ring-white/10" slide={<DeckSlide deck={deck} idx={cur} step={s.current_step} />}
              pin={fmtPin(s.pin)} joinUrl={joinUrl(s.pin)} showQr={l.showQr} reacts={l.floats} {...stageExtras(l)}
              badge={{ x: s.badge_x, y: s.badge_y }} onBadge={b => l.patchSession({ badge_x: b.x, badge_y: b.y })} />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button onClick={l.back} disabled={cur === 0 && s.current_step === 0} className={btn('ghost', 'lg', 'flex-1 sm:flex-none')}><Icon name="prev" />Anterior</button>
              <button onClick={l.next} disabled={cur === n - 1 && s.current_step >= steps} className={btn('primary', 'lg', 'flex-1 sm:flex-none')}>Próximo<Icon name="next" /></button>
              <span className="hidden text-xs text-emerald-100/50 sm:block">Teclado ou passador: <kbd className="font-mono">←</kbd> <kbd className="font-mono">→</kbd> · <kbd className="font-mono">Q</kbd> QR · <kbd className="font-mono">P</kbd> pergunta no telão</span>
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="pane rounded-3xl p-4 sm:p-5">
              <PaneHead title="A seguir" />
              {cur + 1 < n
                ? <DeckSlide deck={deck} idx={cur + 1} step={Infinity} small className="mt-3 overflow-hidden rounded-2xl ring-1 ring-white/10" />
                : <p className="mt-3 grid aspect-video place-items-center rounded-2xl bg-black/20 text-sm text-emerald-100/50">Fim da apresentação</p>}
            </section>
            <section className="pane rounded-3xl p-4 sm:p-5">
              <PaneHead title="Notas do orador" />
              <p className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-pretty leading-relaxed text-emerald-50/90">{deck.slides[cur]?.notes || 'Sem notas neste slide.'}</p>
            </section>
          </div>

          <section aria-label="Todos os slides" className="pane flex gap-2 overflow-x-auto rounded-3xl p-3">
            {deck.slides.map((_, i) => (
              <button key={i} onClick={() => l.go(i)} aria-label={`Ir ao slide ${i + 1}`} aria-current={i === cur}
                className={cx('relative w-32 shrink-0 cursor-pointer overflow-hidden rounded-xl ring-2 transition', i === cur ? 'ring-orange-400' : 'ring-transparent hover:ring-white/25')}>
                <DeckSlide deck={deck} idx={i} step={Infinity} small className="pointer-events-none" />
                <span className="absolute bottom-1 left-1 rounded-md bg-black/60 px-1.5 font-mono text-[10px] text-white">{i + 1}</span>
              </button>
            ))}
          </section>
        </div>

        <aside className="grid content-start gap-4 xl:sticky xl:top-6 xl:self-start">
          {hot && (
            <section className="animate-fade-up rounded-3xl border border-orange-300/30 bg-orange-400/10 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-orange-200"><Icon name="trend" className="size-4" />Em alta · {hot.upvote_count} votos</div>
              <p className="mt-2 font-medium text-white">{hot.text}</p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => l.go(hot.slide)} className={btn('ghost', 'sm')}>Ir ao slide {hot.slide + 1}</button>
                <button onClick={() => l.pin(hot.id)} className={btn('accent', 'sm')}>Exibir no telão</button>
              </div>
            </section>
          )}
          <section className="pane rounded-3xl p-4">
            <Segmented label="Painel" value={tab} onChange={setTab} options={[
              { v: 'fila', label: `Perguntas ${approved.length}` },
              { v: 'mod', label: `Moderação ${pending.length}` },
              { v: 'poll', label: 'Enquete' },
            ]} />
            <div className="mt-4">
              {tab === 'fila' && <Queue l={l} list={queue} />}
              {tab === 'mod' && <Moderation l={l} pending={pending} hidden={hidden} />}
              {tab === 'poll' && <PollPanel l={l} />}
            </div>
          </section>
        </aside>
      </div>
    </Studio>
  )
}

const Empty = ({ children }: { children: string }) => <p className="rounded-2xl border border-dashed border-white/12 p-5 text-center text-sm text-emerald-100/50">{children}</p>

function QItem({ q, children }: { q: QRow; children: React.ReactNode }) {
  return (
    <li className={cx('rounded-2xl border p-3', q.pinned ? 'border-orange-300/40 bg-orange-400/10' : 'border-white/8 bg-white/[0.03]', q.answered && 'opacity-60')}>
      <div className="flex gap-3">
        <span className="grid h-11 w-10 shrink-0 place-items-center rounded-xl bg-white/6 text-center font-display text-sm font-bold leading-none text-white">{q.upvote_count}<span className="text-[9px] font-medium text-emerald-100/50">votos</span></span>
        <div className="min-w-0">
          <p className="text-sm text-white">{q.text}</p>
          <p className="mt-0.5 text-xs text-emerald-100/50">{author(q)} · slide {q.slide + 1}{q.answered && ' · respondida'}{q.pinned && ' · no telão'}</p>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">{children}</div>
    </li>
  )
}

function Queue({ l, list }: { l: Live; list: QRow[] }) {
  if (!list.length) return <Empty>As perguntas da plateia aparecem aqui, das mais votadas para as menos.</Empty>
  return (
    <ul className="grid max-h-[60vh] gap-2 overflow-auto pr-1">
      {list.map(q => (
        <QItem key={q.id} q={q}>
          <button onClick={() => l.go(q.slide)} className={btn('quiet', 'sm')}>Slide {q.slide + 1}</button>
          <button onClick={() => l.patchQ(q.id, { answered: !q.answered, ...(q.answered ? {} : { pinned: false }) })} className={btn('quiet', 'sm')}>{q.answered ? 'Reabrir' : 'Respondida'}</button>
          <button onClick={() => l.pin(q.id)} className={btn(q.pinned ? 'accent' : 'quiet', 'sm')}><Icon name="pin" className="size-3.5" />{q.pinned ? 'Tirar do telão' : 'Telão'}</button>
          <button onClick={() => l.patchQ(q.id, { status: 'hidden', pinned: false })} className={btn('quiet', 'sm')}>Ocultar</button>
        </QItem>
      ))}
    </ul>
  )
}

function Moderation({ l, pending, hidden }: { l: Live; pending: QRow[]; hidden: QRow[] }) {
  const [showHidden, setShowHidden] = useState(false)
  const s = l.session!
  return (
    <div className="grid gap-4">
      <div className="glass-soft grid gap-3 rounded-2xl p-3">
        <Switch on={s.moderation} onChange={() => l.patchSession({ moderation: !s.moderation })} label="Moderar perguntas" hint="Novas perguntas esperam sua aprovação" />
        <Switch on={s.free_nav} onChange={() => l.patchSession({ free_nav: !s.free_nav })} label="Navegação livre" hint="Plateia revê slides que já passaram" />
      </div>
      {pending.length ? (
        <ul className="grid max-h-[45vh] gap-2 overflow-auto pr-1">
          {pending.map(q => (
            <QItem key={q.id} q={q}>
              <button onClick={() => l.patchQ(q.id, { status: 'approved' })} className={btn('primary', 'sm')}><Icon name="check" className="size-3.5" />Aprovar</button>
              {q.dup_of && <button onClick={() => l.patchQ(q.id, { status: 'merged' })} className={btn('quiet', 'sm')}>Mesclar</button>}
              <button onClick={() => l.patchQ(q.id, { status: 'hidden' })} className={btn('quiet', 'sm')}>Ocultar</button>
            </QItem>
          ))}
        </ul>
      ) : <Empty>{s.moderation ? 'Nada para moderar agora.' : 'Moderação desligada: perguntas são publicadas direto.'}</Empty>}
      {hidden.length > 0 && (
        <div className="text-sm">
          <button onClick={() => setShowHidden(v => !v)} aria-expanded={showHidden} className={btn('quiet', 'sm', '-ml-2')}>
            <Icon name="next" className={cx('size-3.5 transition', showHidden && 'rotate-90')} />Ocultas ({hidden.length})
          </button>
          {showHidden && (
            <ul className="animate-fade-up mt-2 grid gap-2">
              {hidden.map(q => <QItem key={q.id} q={q}><button onClick={() => l.patchQ(q.id, { status: 'approved' })} className={btn('quiet', 'sm')}>Restaurar</button></QItem>)}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function PollPanel({ l }: { l: Live }) {
  const p = l.poll
  const [creating, setCreating] = useState(!p)
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const valid = question.trim() && options.filter(o => o.trim()).length >= 2

  const launch = async () => {
    if (!valid) return
    if (p?.status === 'open') await l.patchPoll(p.id, { status: 'closed', on_stage: false })
    if (await l.launchPoll(question.trim(), options.map(o => o.trim()).filter(Boolean))) {
      setCreating(false); setQuestion(''); setOptions(['', ''])
    }
  }

  if (creating || !p) return (
    <form onSubmit={e => { e.preventDefault(); launch() }} className="grid gap-2.5">
      <label className="text-sm font-medium text-white" htmlFor="pq">Pergunta</label>
      <input id="pq" value={question} onChange={e => setQuestion(e.target.value)} maxLength={200} placeholder="Ex.: Qual opção você usaria?"
        className="rounded-xl border border-white/12 bg-black/25 px-3 py-2.5 text-sm text-white outline-none placeholder:text-emerald-100/35 focus:border-emerald-300" />
      <span className="text-sm font-medium text-white">Opções</span>
      {options.map((o, i) => (
        <div key={i} className="flex gap-2">
          <input value={o} onChange={e => setOptions(os => os.map((x, j) => (j === i ? e.target.value : x)))} maxLength={80} aria-label={`Opção ${i + 1}`} placeholder={`Opção ${i + 1}`}
            className="min-w-0 flex-1 rounded-xl border border-white/12 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-emerald-100/35 focus:border-emerald-300" />
          {options.length > 2 && <button type="button" onClick={() => setOptions(os => os.filter((_, j) => j !== i))} aria-label={`Remover opção ${i + 1}`} className={btn('quiet', 'sm', 'size-10 px-0')}><Icon name="x" className="size-4" /></button>}
        </div>
      ))}
      {options.length < 6 && <button type="button" onClick={() => setOptions(os => [...os, ''])} className={btn('quiet', 'sm', 'justify-self-start')}>+ Adicionar opção</button>}
      <div className="mt-1 flex gap-2">
        <button disabled={!valid} className={btn('primary', 'md', 'flex-1')}><Icon name="poll" />Lançar enquete</button>
        {p && <button type="button" onClick={() => setCreating(false)} className={btn('ghost', 'md')}>Cancelar</button>}
      </div>
    </form>
  )

  const total = p.counts.reduce((a, b) => a + b, 0)
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-white">{p.question}</p>
        <Chip tone={p.status === 'open' ? 'orange' : 'gray'} className="shrink-0">{p.status === 'open' ? 'Aberta' : 'Encerrada'}</Chip>
      </div>
      <ul className="mt-3 grid gap-2.5">
        {p.options.map((o, i) => {
          const pct = total ? Math.round((p.counts[i] / total) * 100) : 0
          return (
            <li key={i}>
              <div className="flex justify-between gap-2 text-sm"><span className="text-emerald-50">{o}</span><span className="tabular-nums text-emerald-100/60">{p.counts[i]} · {pct}%</span></div>
              <Bar pct={pct} />
            </li>
          )
        })}
      </ul>
      <p className="mt-2 text-xs text-emerald-100/50">{total} votos</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {p.status === 'open' && <button onClick={() => l.patchPoll(p.id, { status: 'closed' })} className={btn('accent', 'sm')}>Encerrar votação</button>}
        <button onClick={() => l.patchPoll(p.id, { on_stage: !p.on_stage })} className={btn('ghost', 'sm')}>{p.on_stage ? 'Ocultar do telão' : 'Mostrar no telão'}</button>
        <button onClick={() => setCreating(true)} className={btn('quiet', 'sm', 'col-span-2')}>Nova enquete</button>
      </div>
    </div>
  )
}
