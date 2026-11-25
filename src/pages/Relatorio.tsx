import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { DECK_TITLE, POLL } from '../data'
import { Bar, btn, Chip, cx, Segmented } from '../ui'
import { SideNav } from './Upload'

const TITLES = ['Abertura', 'Por que distribuir?', 'Três motivos', 'Teorema CAP', 'Hotspots em contadores', 'Incremento atômico', 'Efêmero × persistente', 'Consistência eventual', 'Padrões na prática', 'Idempotência', 'Observabilidade', 'Encerramento']
type Metric = 'perguntas' | 'reacoes' | 'notas'
const DATA: Record<Metric, number[]> = {
  perguntas: [1, 0, 3, 7, 12, 4, 2, 1, 0, 1, 0, 0],
  reacoes: [80, 20, 95, 140, 210, 180, 150, 90, 25, 70, 64, 80],
  notas: [40, 5, 88, 120, 140, 96, 110, 72, 8, 64, 51, 12],
}
const LABELS: Record<Metric, string> = { perguntas: 'Perguntas', reacoes: 'Reações', notas: 'Notas' }
type St = 'answered' | 'open' | 'hidden'
const QS: { votes: number; text: string; slide: number; status: St }[] = [
  { votes: 58, text: 'Como evitar hotspotting em contadores distribuídos?', slide: 4, status: 'answered' },
  { votes: 34, text: 'O teorema CAP ainda vale com redes modernas de baixa latência?', slide: 3, status: 'answered' },
  { votes: 21, text: 'Shards de contador não deixam a leitura mais cara?', slide: 4, status: 'answered' },
  { votes: 17, text: 'Vale a pena usar CRDTs para notas colaborativas?', slide: 6, status: 'open' },
  { votes: 14, text: 'Para o usuário final, qual a diferença real entre consistência eventual e forte?', slide: 3, status: 'answered' },
  { votes: 12, text: 'Qual livro você recomenda para começar em sistemas distribuídos?', slide: 2, status: 'answered' },
  { votes: 11, text: 'Como testar o comportamento do sistema durante uma partição?', slide: 3, status: 'open' },
  { votes: 9, text: 'O incremento atômico funciona offline?', slide: 5, status: 'open' },
  { votes: 6, text: 'Quantos shards usar para um contador com 500 escritas por segundo?', slide: 4, status: 'open' },
  { votes: 0, text: 'Alguém sabe a senha do Wi-Fi?', slide: 2, status: 'hidden' },
]
const STATUS = { answered: ['Respondida', 'green'], open: ['Sem resposta', 'orange'], hidden: ['Oculta', 'gray'] } as const
const KPIS = [['Pico de público', '312'], ['Perguntas enviadas', '31'], ['Votos em perguntas', '486'], ['Reações', '1.204'], ['Pessoas que anotaram', '61%']]
const PV = [142, 88, 41, 23]
const PT = PV.reduce((a, b) => a + b, 0)

export default function Relatorio() {
  const [metric, setMetric] = useState<Metric>('perguntas')
  const [sel, setSel] = useState<number | null>(null)
  const [exported, setExported] = useState(false)
  useEffect(() => { if (!exported) return; const t = setTimeout(() => setExported(false), 2500); return () => clearTimeout(t) }, [exported])

  const arr = DATA[metric], max = Math.max(...arr), sum = arr.reduce((a, b) => a + b, 0)
  const top = arr.indexOf(max), share = Math.round((max / sum) * 100)
  const insight = metric === 'perguntas' ? `O slide ${top + 1} (${TITLES[top]}) concentrou ${share}% das dúvidas — vale reforçar esse trecho na próxima edição.`
    : metric === 'reacoes' ? `O slide ${top + 1} (${TITLES[top]}) foi o de maior reação da plateia, com ${share}% do total.`
    : `O slide ${top + 1} (${TITLES[top]}) recebeu mais anotações: ${max} pessoas escreveram nele.`
  const rows = QS.filter(q => sel === null || q.slide === sel)

  return (
    <div className="lg:pl-66">
      <SideNav />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8 lg:py-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-emerald-100/60">Sessão encerrada · [DATA] · 47 min <Chip tone="orange">Dados de exemplo</Chip></div>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">{DECK_TITLE}</h1>
          </div>
          <div className="flex gap-2">
            <Link to="/upload" className={btn('ghost', 'md')}>Biblioteca</Link>
            <button onClick={() => setExported(true)} className={btn(exported ? 'ghost' : 'primary', 'md')}>{exported ? '✓ CSV exportado' : 'Exportar CSV'}</button>
          </div>
        </header>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {KPIS.map(([label, value], i) => (
            <div key={label} className={cx('glass rounded-3xl p-5', i === 4 && 'col-span-2 sm:col-span-1')}>
              <div className="text-xs font-medium text-emerald-100/60">{label}</div>
              <div className={cx('mt-2 font-display text-3xl font-bold tracking-tight', i % 2 ? 'text-orange-300' : 'text-white')}>{value}</div>
            </div>
          ))}
        </div>

        <section className="glass mt-6 rounded-[2rem] p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold text-white">Engajamento por slide</h2>
            <Segmented label="Métrica" value={metric} onChange={setMetric} options={(Object.keys(LABELS) as Metric[]).map(k => ({ v: k, label: LABELS[k] }))} />
          </div>
          <p className="mt-3 rounded-2xl border border-orange-300/20 bg-orange-400/8 px-4 py-3 text-sm text-orange-100">{insight}</p>
          <div className="mt-6 overflow-x-auto">
            <div className="flex h-60 min-w-[520px] items-end gap-2">
              {arr.map((v, i) => {
                const on = sel === i, dim = sel !== null && !on
                return (
                  <div key={i} className="flex flex-1 flex-col items-center gap-2">
                    <button onClick={() => setSel(on ? null : i)} aria-pressed={on} aria-label={`Slide ${i + 1}, ${TITLES[i]}: ${v} ${LABELS[metric].toLowerCase()}`}
                      className="group flex w-full flex-col items-center justify-end gap-1" style={{ height: 210 }}>
                      <span className={cx('text-xs font-semibold', dim ? 'text-emerald-100/35' : 'text-white')}>{v}</span>
                      <span className={cx('liquid w-full rounded-t-xl rounded-b-sm transition-all duration-500 group-hover:brightness-125',
                        on ? 'bg-gradient-to-b from-orange-300 to-orange-500' : dim ? 'bg-white/10' : i === top ? 'bg-gradient-to-b from-emerald-300 to-emerald-500' : 'bg-gradient-to-b from-emerald-400/60 to-emerald-600/40')}
                        style={{ height: Math.max(2, Math.round((v / max) * 180)) }} />
                    </button>
                    <span className={cx('text-xs', on ? 'font-bold text-orange-300' : 'text-emerald-100/55')}>{i + 1}</span>
                  </div>
                )
              })}
            </div>
          </div>
          <p className="mt-3 text-xs text-emerald-100/45">Clique em uma barra para filtrar as perguntas daquele slide.</p>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="glass rounded-[2rem] p-5 sm:p-7">
            <h2 className="font-display text-xl font-semibold text-white">Enquete</h2>
            <p className="mt-1 text-sm text-emerald-100/65">{POLL.q}</p>
            <div className="mt-5 space-y-4">
              {POLL.options.map((label, i) => {
                const p = Math.round((PV[i] / PT) * 100)
                return (
                  <div key={label}>
                    <div className="mb-1.5 flex justify-between gap-3 text-sm"><span className="text-emerald-50">{label}</span><span className="font-semibold text-white">{p}%</span></div>
                    <Bar pct={p} mine={i === 0} />
                  </div>
                )
              })}
            </div>
            <p className="mt-4 text-xs text-emerald-100/45">{PT} votos · lançada no slide 6</p>
          </section>
          <section className="glass rounded-[2rem] p-5 sm:p-7">
            <h3 className="font-display text-xl font-semibold text-white">Reações</h3>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {[['🔥', 612, 'Fogo'], ['👏', 398, 'Aplauso'], ['😮', 194, 'Uau']].map(([e, n, l]) => (
                <div key={l} className="glass-soft flex flex-col items-center rounded-2xl py-5">
                  <span className="text-3xl" aria-hidden>{e}</span>
                  <span className="mt-2 font-display text-2xl font-bold text-white">{n}</span>
                  <span className="text-xs text-emerald-100/55">{l}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="glass mt-6 rounded-[2rem] p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold text-white">{sel === null ? 'Perguntas arquivadas' : `Perguntas do slide ${sel + 1} · ${TITLES[sel]}`}</h2>
            {sel !== null && <button onClick={() => setSel(null)} className={btn('ghost', 'sm')}>Limpar filtro</button>}
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-emerald-100/50">
                <tr><th className="py-2 pr-4 font-semibold">Votos</th><th className="py-2 pr-4 font-semibold">Pergunta</th><th className="py-2 pr-4 font-semibold">Slide</th><th className="py-2 font-semibold">Situação</th></tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.text} className="border-t border-white/8">
                    <td className="py-3 pr-4 font-display text-base font-bold text-white">{r.votes}</td>
                    <td className="py-3 pr-4 text-emerald-50">{r.text}</td>
                    <td className="whitespace-nowrap py-3 pr-4 text-emerald-100/60">Slide {r.slide + 1}</td>
                    <td className="py-3"><Chip tone={STATUS[r.status][1]}>{STATUS[r.status][0]}</Chip></td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={4} className="py-6 text-center text-emerald-100/50">Nenhuma pergunta neste slide.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}
