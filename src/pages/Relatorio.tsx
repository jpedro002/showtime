import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useSession } from '../Auth'
import { listSessions, minutes, type SessionRow, type SessionSummary } from '../decks'
import { supabase } from '../supabase'
import { Icon, PaneHead, Stat, Studio } from '../Studio'
import { Bar, btn, Chip, cx, LiveDot, Segmented } from '../ui'

type Metric = 'questions' | 'reactions' | 'notes'
type SlideStat = { slide: number; title: string } & Record<Metric, number>
type Poll = { id: number; question: string; options: string[]; counts: number[]; status: string }
type Question = {
  id: number; nickname: string | null; text: string; slide: number
  status: 'pending' | 'approved' | 'hidden' | 'merged'; answered: boolean; upvotes: number; created_at: string
}
type Report = {
  session: SessionRow
  kpis: { participants: number; peak_online: number; questions: number; question_votes: number; reactions: number; notes_authors: number; duration_s: number }
  per_slide: SlideStat[]; polls: Poll[]; questions: Question[]
  deck: { title: string; duration_min: number }; reactions: Record<string, number>
}

const LABELS: Record<Metric, string> = { questions: 'Perguntas', reactions: 'Reações', notes: 'Notas' }
type St = 'answered' | 'open' | 'pending' | 'hidden'
const STATUS = { answered: ['Respondida', 'green'], open: ['Sem resposta', 'orange'], pending: ['Pendente', 'gray'], hidden: ['Oculta', 'gray'] } as const
const stOf = (q: Question): St => q.answered ? 'answered' : q.status === 'approved' ? 'open' : q.status === 'pending' ? 'pending' : 'hidden'
const REACTIONS = [['fogo', '🔥', 'Fogo'], ['palmas', '👏', 'Aplausos'], ['uau', '😮', 'Uau']] as const

const num = (n: number) => n.toLocaleString('pt-BR')
const pl = (n: number, word: string) => `${num(n)} ${word}${n === 1 ? '' : 's'}`
const day = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })

/** /relatorio lists the owner's sessions; /relatorio/:sessionId shows the report of one session. */
export default function Relatorio() {
  const { sessionId } = useParams()
  return sessionId ? <ReportPage key={sessionId} id={sessionId} /> : <Sessions />
}

function Sessions() {
  const owner = useSession()?.user.id
  const [list, setList] = useState<SessionSummary[] | Error>()
  useEffect(() => { if (owner) listSessions({ owner_id: owner }).then(setList, setList) }, [owner])

  return (
    <Studio title="Relatórios" sub="Todas as suas sessões, da mais recente para a mais antiga.">
      {list instanceof Error ? <p role="alert" className="text-rose-300">Não foi possível carregar as sessões: {list.message}</p>
        : !list ? <p role="status" className="text-emerald-100/60">Carregando sessões…</p>
        : !list.length ? (
          <section className="pane rounded-[2rem] p-8 text-center">
            <p className="text-emerald-100/70">Você ainda não apresentou nenhuma sessão.</p>
            <Link to="/upload" className={btn('primary', 'md', 'mt-4')}><Icon name="library" className="size-4" />Ir para a biblioteca</Link>
          </section>
        ) : (
          <ul className="pane divide-y divide-white/8 rounded-[2rem] px-4 py-1 sm:px-6">
            {list.map(s => {
              const live = s.status === 'live'
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-3 py-4">
                  <Link to={`/relatorio/${s.id}`} className="group min-w-0 flex-1 rounded-xl">
                    <span className="block truncate font-display text-base font-semibold text-white underline-offset-4 group-hover:underline">{s.decks?.title ?? 'Apresentação'}</span>
                    <span className="mt-0.5 block text-sm text-emerald-100/55">
                      {day(s.started_at)} · {minutes(s)} min · {pl(s.participants[0]?.count ?? 0, 'participante')} · {pl(s.questions[0]?.count ?? 0, 'pergunta')}
                    </span>
                  </Link>
                  <Chip tone={live ? 'orange' : 'gray'}>{live && <LiveDot />}{live ? 'Ao vivo' : 'Encerrada'}</Chip>
                  {live && <Link to={`/presenter/${s.id}`} className={btn('accent', 'sm')}><Icon name="live" className="size-3.5" />Abrir console</Link>}
                </li>
              )
            })}
          </ul>
        )}
    </Studio>
  )
}

async function loadReport(id: string): Promise<Report> {
  const { data, error } = await supabase.rpc('session_report', { p_session_id: id })
  if (error) throw error
  const [rc, deck] = await Promise.all([
    supabase.from('reaction_counts').select('kind, count').eq('session_id', id),
    supabase.from('decks').select('title, duration_min').eq('id', data.session.deck_id).single(),
  ])
  if (rc.error ?? deck.error) throw rc.error ?? deck.error
  const reactions: Record<string, number> = {}
  for (const r of rc.data as { kind: string; count: number }[]) reactions[r.kind] = (reactions[r.kind] ?? 0) + r.count
  return { ...data, deck: deck.data, reactions }
}

function ReportPage({ id }: { id: string }) {
  const [r, setR] = useState<Report | Error>()
  useEffect(() => { loadReport(id).then(setR, setR) }, [id])
  if (r instanceof Error) return (
    <Studio kicker="Relatório" title="Relatório não encontrado" sub="Esta sessão não existe, foi apagada ou pertence a outra conta."
      actions={<Link to="/relatorio" className={btn('ghost', 'md')}><Icon name="chart" className="size-4" />Todos os relatórios</Link>}>
      <p role="alert" className="text-sm text-emerald-100/50">{r.message}</p>
    </Studio>
  )
  if (!r) return <Studio kicker="Relatório" title="Carregando…"><p role="status" className="text-emerald-100/60">Carregando relatório…</p></Studio>
  return <ReportView r={r} />
}

// Audience text starting with = + - @ would run as a formula in Excel.
const cell = (v: string | number) => `"${String(v).replace(/^[=+\-@\t\r]/, "'$&").replace(/"/g, '""')}"`

function downloadCsv(name: string, qs: Question[]) {
  const lines = [['votos', 'pergunta', 'autor', 'slide', 'situacao', 'respondida'],
    ...qs.map(q => [q.upvotes, q.text, q.nickname ?? 'Anônimo', q.slide + 1, STATUS[stOf(q)][0], q.answered ? 'sim' : 'não'])]
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + lines.map(l => l.map(cell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

function ReportView({ r }: { r: Report }) {
  const { session: s, kpis: k, per_slide: slides, polls, questions: qs } = r
  const [metric, setMetric] = useState<Metric>('questions')
  const [sel, setSel] = useState<number | null>(null)
  const [status, setStatus] = useState<St | 'all'>('all')
  const [query, setQuery] = useState('')
  const [pollIdx, setPollIdx] = useState('0')
  const [exported, setExported] = useState(false)
  useEffect(() => { if (!exported) return; const t = setTimeout(() => setExported(false), 2500); return () => clearTimeout(t) }, [exported])

  const name = (i: number) => { const t = slides.find(x => x.slide === i)?.title; return t ? `slide ${i + 1} (${t})` : `slide ${i + 1}` }
  const arr = slides.map(x => x[metric]), max = Math.max(0, ...arr), sum = arr.reduce((a, b) => a + b, 0)
  const top = max ? arr.indexOf(max) : -1, share = sum ? Math.round((max / sum) * 100) : 0
  const topName = top < 0 ? '' : name(slides[top].slide)
  const insight = !sum ? `Não houve ${LABELS[metric].toLowerCase()} nesta sessão.`
    : metric === 'questions' ? `O ${topName} concentrou ${share}% das dúvidas. Vale reforçar esse trecho na próxima edição.`
    : metric === 'reactions' ? `O ${topName} foi o de maior reação da plateia, com ${share}% do total.`
    : `O ${topName} recebeu mais anotações: ${pl(max, 'nota')}.`
  const needle = query.trim().toLowerCase()
  const rows = qs.filter(q => (sel === null || q.slide === sel) && (status === 'all' || stOf(q) === status) && (!needle || q.text.toLowerCase().includes(needle)))

  const real = minutes(s), planned = r.deck.duration_min, over = real > planned * 1.1
  const poll = polls[Number(pollIdx)]
  const pTotal = poll ? poll.counts.reduce((a, b) => a + b, 0) : 0, pMax = poll ? Math.max(0, ...poll.counts) : 0
  const rMax = Math.max(0, ...REACTIONS.map(([kind]) => r.reactions[kind] ?? 0))

  return (
    <Studio
      kicker={<>
        {s.status === 'live' ? <Chip tone="orange"><LiveDot />Ao vivo agora</Chip> : 'Sessão encerrada'}
        <span>· {day(s.started_at)} · {real} min ·</span>
        <span className={cx(over && 'font-semibold text-orange-300')}>previsto {planned} min{over && ' · passou do tempo'}</span>
      </>}
      title={r.deck.title}
      actions={<>
        <Link to={`/deck/${s.deck_id}`} className={btn('ghost', 'md')}><Icon name="library" className="size-4" />Ver apresentação</Link>
        <button onClick={() => { downloadCsv(`perguntas-${s.started_at.slice(0, 10)}.csv`, qs); setExported(true) }} disabled={!qs.length} className={btn(exported ? 'ghost' : 'primary', 'md')}>
          <Icon name={exported ? 'check' : 'download'} className="size-4" />{exported ? 'CSV exportado' : 'Exportar CSV'}
        </button>
      </>}
    >
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat accent label="Pico de público" icon="users" value={num(k.peak_online)} hint={`${pl(k.participants, 'participante')} no total`} />
        <Stat label="Perguntas" icon="message" value={num(k.questions)} hint={pl(k.question_votes, 'voto')} />
        <Stat label="Reações" icon="flame" value={num(k.reactions)} hint={k.participants ? `${(k.reactions / k.participants).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} por pessoa` : undefined} />
        <Stat label="Pessoas que anotaram" icon="book" value={`${k.participants ? Math.round((k.notes_authors / k.participants) * 100) : 0}%`} hint={`${num(k.notes_authors)} de ${pl(k.participants, 'pessoa')}`} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-label="Engajamento por slide" className="pane rounded-[2rem] p-5 sm:p-6">
          <PaneHead title="Engajamento por slide" sub="Clique em uma barra para filtrar as perguntas" aside={
            <Segmented label="Métrica" value={metric} onChange={setMetric} options={(Object.keys(LABELS) as Metric[]).map(v => ({ v, label: LABELS[v] }))} />
          } />
          <p className="mt-4 flex gap-2.5 rounded-2xl border border-orange-300/20 bg-orange-400/8 px-4 py-3 text-sm text-orange-100">
            <Icon name="trend" className="mt-0.5 size-4 text-orange-300" />{insight}
          </p>
          <div className="mt-5 overflow-x-auto">
            <div style={{ minWidth: Math.max(520, slides.length * 36) }} className="relative flex h-64 items-end gap-2 bg-[linear-gradient(to_top,rgb(255_255_255/0.06)_1px,transparent_1px)] bg-[length:100%_25%] pb-6">
              {slides.map((x, i) => {
                const v = x[metric], on = sel === x.slide, dim = sel !== null && !on
                return (
                  <button key={x.slide} onClick={() => setSel(on ? null : x.slide)} aria-pressed={on} aria-label={`${name(x.slide)}: ${v} ${LABELS[metric].toLowerCase()}`}
                    className="group relative flex h-full flex-1 cursor-pointer flex-col items-center justify-end gap-1">
                    <span className={cx('text-xs font-semibold tabular-nums', dim ? 'text-emerald-100/35' : 'text-white')}>{v}</span>
                    <span className={cx('liquid w-full rounded-t-xl rounded-b-sm transition-[height,background-color,filter] duration-500 ease-[cubic-bezier(0.2,0,0,1)] group-hover:brightness-125',
                      on ? 'bg-gradient-to-b from-orange-300 to-orange-500' : dim ? 'bg-white/10' : i === top ? 'bg-gradient-to-b from-emerald-300 to-emerald-500' : 'bg-gradient-to-b from-emerald-400/55 to-emerald-700/40')}
                      style={{ height: Math.max(2, max ? Math.round((v / max) * 190) : 0) }} />
                    <span className={cx('absolute -bottom-6 text-xs tabular-nums', on ? 'font-bold text-orange-300' : 'text-emerald-100/55')}>{x.slide + 1}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
          <section aria-label="Enquete" className="pane rounded-[2rem] p-5">
            <PaneHead title={polls.length > 1 ? 'Enquetes' : 'Enquete'} sub={poll && pl(pTotal, 'voto')} aside={polls.length > 1 &&
              <Segmented label="Escolher enquete" value={pollIdx} onChange={setPollIdx} options={polls.map((_, i) => ({ v: String(i), label: i + 1 }))} />
            } />
            {poll ? <>
              <p className="mt-3 text-sm font-medium text-emerald-50">{poll.question}</p>
              <div className="mt-4 space-y-3">
                {poll.options.map((label, i) => {
                  const c = poll.counts[i] ?? 0, p = pTotal ? Math.round((c / pTotal) * 100) : 0
                  return (
                    <div key={i}>
                      <div className="mb-1 flex justify-between gap-3 text-sm"><span className="text-emerald-100/80">{label}</span><span className="font-semibold tabular-nums text-white">{p}%</span></div>
                      <Bar pct={p} mine={pMax > 0 && c === pMax} />
                    </div>
                  )
                })}
              </div>
            </> : <p className="mt-3 text-sm text-emerald-100/50">Nenhuma enquete foi lançada nesta sessão.</p>}
          </section>
          <section aria-label="Reações" className="pane rounded-[2rem] p-5">
            <PaneHead title="Reações" sub={`${num(k.reactions)} no total`} />
            {rMax ? (
              <ul className="mt-4 space-y-3">
                {REACTIONS.map(([kind, e, l]) => {
                  const n = r.reactions[kind] ?? 0
                  return (
                    <li key={kind} className="flex items-center gap-3">
                      <span className="glass-soft grid size-11 shrink-0 place-items-center rounded-xl text-xl" aria-hidden>{e}</span>
                      <span className="min-w-0 flex-1">
                        <span className="mb-1 flex justify-between text-sm"><span className="text-emerald-100/80">{l}</span><span className="font-semibold tabular-nums text-white">{num(n)}</span></span>
                        <Bar pct={(n / rMax) * 100} />
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : <p className="mt-3 text-sm text-emerald-100/50">Ninguém reagiu nesta sessão.</p>}
          </section>
        </div>
      </div>

      <section aria-label="Perguntas" className="pane mt-4 rounded-[2rem] p-5 sm:p-6">
        <PaneHead
          title={sel === null ? 'Perguntas arquivadas' : `Perguntas do ${name(sel)}`}
          sub={`${rows.length} de ${qs.length}`}
          aside={sel !== null && <button onClick={() => setSel(null)} className={btn('ghost', 'sm')}><Icon name="x" className="size-3.5" />Limpar slide</button>}
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="glass-soft flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full px-4 text-emerald-100/60 focus-within:ring-2 focus-within:ring-orange-400/60 sm:max-w-xs">
            <Icon name="search" className="size-4" />
            <span className="sr-only">Buscar pergunta</span>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar pergunta" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-emerald-100/40" />
          </label>
          <Segmented label="Situação" value={status} onChange={setStatus} options={[
            { v: 'all', label: 'Todas' }, { v: 'answered', label: 'Respondidas' }, { v: 'open', label: 'Sem resposta' }, { v: 'hidden', label: 'Ocultas' },
          ]} />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-emerald-100/50">
              <tr><th className="py-2 pr-4 font-semibold">Votos</th><th className="py-2 pr-4 font-semibold">Pergunta</th><th className="py-2 pr-4 font-semibold">Slide</th><th className="py-2 font-semibold">Situação</th></tr>
            </thead>
            <tbody>
              {rows.map(q => {
                const [label, tone] = STATUS[stOf(q)]
                return (
                  <tr key={q.id} className="border-t border-white/8 transition hover:bg-white/[0.03]">
                    <td className="py-3 pr-4 font-display text-base font-bold tabular-nums text-white">{q.upvotes}</td>
                    <td className="py-3 pr-4 text-emerald-50">{q.text}<span className="block text-xs text-emerald-100/45">{q.nickname ?? 'Anônimo'}</span></td>
                    <td className="whitespace-nowrap py-3 pr-4">
                      <button onClick={() => setSel(q.slide)} className="cursor-pointer text-emerald-100/60 underline-offset-4 hover:text-white hover:underline">Slide {q.slide + 1}</button>
                    </td>
                    <td className="py-3"><Chip tone={tone}>{label}</Chip></td>
                  </tr>
                )
              })}
              {!rows.length && <tr><td colSpan={4} className="py-8 text-center text-emerald-100/50">{qs.length ? 'Nenhuma pergunta com esses filtros.' : 'Nenhuma pergunta foi enviada nesta sessão.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </Studio>
  )
}
