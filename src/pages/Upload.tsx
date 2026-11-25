import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router'
import type { SlideData } from '../data'
import { DECK, DECK_TITLE, PIN } from '../data'
import { QR, Slide } from '../Slide'
import { btn, Chip, cx, Logo, Segmented, Switch } from '../ui'

type Fmt = 'pdf' | 'pptx'
const STEPS: Record<Fmt, [string, string][]> = {
  pdf: [
    ['Enviando ao armazenamento', 'Upload do PDF original'],
    ['Renderizando páginas', 'Leitura página a página do PDF'],
    ['Gerando imagens WebP', '1920×1080 para o telão e 1280×720 para celular'],
    ['Extraindo texto', 'Texto puro para busca e leitores de tela'],
    ['Pronto', 'Apresentação disponível na biblioteca'],
  ],
  pptx: [
    ['Enviando ao armazenamento', 'Upload do .pptx original'],
    ['Convertendo para PDF', 'LibreOffice headless preserva fontes e layout'],
    ['Gerando imagens WebP', '1920×1080 para o telão e 1280×720 para celular'],
    ['Extraindo texto e notas', 'Inclui as notas do orador do PowerPoint'],
    ['Pronto', 'Apresentação disponível na biblioteca'],
  ],
}
type Deck = { id: string; title: string; slides: number; ready: boolean; when: string; cover: SlideData }
const cover = (kicker: string, title: string, sub: string): SlideData => ({ kind: 'cover', kicker, title, sub, foot: '[SEU NOME] · [EVENTO]' })
const BASE: Deck[] = [
  { id: 'd1', title: DECK_TITLE, slides: 12, ready: true, when: 'Atualizada há 2 dias', cover: DECK[0] },
  { id: 'd2', title: 'Filas e mensageria sem mistério', slides: 18, ready: true, when: 'Atualizada há 3 semanas', cover: cover('Workshop', 'Filas e mensageria sem mistério', 'Quando usar fila, tópico ou stream — e como não perder mensagens') },
]

export function SideNav() {
  const item = ({ isActive }: { isActive: boolean }) => cx('rounded-full px-4 py-2 text-sm font-medium transition whitespace-nowrap', isActive ? 'liquid bg-white/15 text-white' : 'text-emerald-100/70 hover:bg-white/5 hover:text-white')
  return (
    <nav aria-label="Menu principal" className="glass sticky top-3 z-20 m-3 flex items-center gap-2 overflow-x-auto rounded-3xl p-3 lg:fixed lg:inset-y-3 lg:left-3 lg:m-0 lg:w-60 lg:flex-col lg:items-stretch lg:overflow-visible lg:p-5">
      <div className="mr-2 lg:mb-6 lg:mr-0"><Logo /></div>
      <NavLink to="/upload" className={item}>Apresentações</NavLink>
      <NavLink to="/live" className={item}>Sessão ao vivo</NavLink>
      <NavLink to="/relatorio" className={item}>Relatórios</NavLink>
      <div className="ml-auto flex items-center gap-3 lg:ml-0 lg:mt-auto">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-orange-400 text-xs font-bold text-ink">SN</span>
        <span className="hidden text-sm leading-tight lg:block"><span className="block font-semibold text-white">[SEU NOME]</span><span className="text-emerald-100/55">Conta Google</span></span>
      </div>
    </nav>
  )
}

export default function Upload() {
  const [fmt, setFmt] = useState<Fmt>('pptx')
  const [pct, setPct] = useState<number | null>(null)
  const [decks, setDecks] = useState(BASE)
  const [modal, setModal] = useState<string | null>(null)
  const [freeNav, setFreeNav] = useState(true)
  const [moderation, setModeration] = useState(false)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach(clearInterval), [])

  const start = () => {
    const id = 'd' + Date.now()
    setDecks(d => [{ id, title: 'Workshop de Observabilidade', slides: 24, ready: false, when: 'Enviada agora', cover: cover('Workshop', 'Workshop de Observabilidade', 'Logs, métricas e traces que respondem perguntas reais') }, ...d])
    setPct(0)
    const step = fmt === 'pdf' ? 2.2 : 1.4
    let p = 0
    const iv = window.setInterval(() => {
      p = Math.min(100, p + step)
      setPct(p)
      if (p >= 100) {
        clearInterval(iv)
        setDecks(d => d.map(x => (x.id === id ? { ...x, ready: true } : x)))
        timers.current.push(window.setTimeout(() => setPct(null), 2200))
      }
    }, 120)
    timers.current.push(iv)
  }

  const active = pct === null ? 0 : pct >= 100 ? 4 : Math.min(3, Math.floor(pct / 25))
  const fileName = fmt === 'pdf' ? 'workshop-observabilidade.pdf' : 'workshop-observabilidade.pptx'

  return (
    <div className="lg:pl-66">
      <SideNav />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8 lg:py-10">
        <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">Suas apresentações</h1>
        <p className="mt-2 max-w-2xl text-emerald-100/65">Envie um PDF ou PowerPoint. Cada página vira uma imagem leve para celular e uma em alta para o telão.</p>

        <section aria-label="Enviar apresentação" className="glass mt-8 rounded-[2rem] p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold text-white">Nova apresentação</h2>
            <Segmented label="Formato do arquivo" value={fmt} onChange={setFmt} disabled={pct !== null}
              options={[{ v: 'pdf', label: 'PDF' }, { v: 'pptx', label: 'PowerPoint (.pptx)' }]} />
          </div>

          {pct === null ? (
            <div className="mt-5 flex flex-col items-center rounded-3xl border-2 border-dashed border-emerald-300/25 bg-emerald-400/[0.03] px-6 py-12 text-center transition hover:border-orange-300/50 hover:bg-orange-400/[0.04]">
              <div className="liquid grid size-14 place-items-center rounded-2xl bg-gradient-to-b from-emerald-300 to-emerald-500 text-ink">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 16V4" /><path d="m6 10 6-6 6 6" /><path d="M4 20h16" /></svg>
              </div>
              <div className="mt-4 font-display text-lg font-semibold text-white">Arraste o arquivo aqui</div>
              <p className="mt-1 max-w-lg text-sm text-emerald-100/60">{fmt === 'pdf' ? 'O jeito mais rápido: exporte seus slides como PDF. Fontes e layout chegam exatamente como no seu computador.' : 'Envie o PowerPoint direto. Convertemos no servidor para que fontes e layout não quebrem no celular de ninguém, e aproveitamos suas notas do orador.'}</p>
              <button onClick={start} className={btn('primary', 'md', 'mt-5')}>Escolher {fmt === 'pdf' ? 'PDF' : 'arquivo .pptx'}</button>
            </div>
          ) : (
            <div className="animate-fade-up mt-5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-mono text-emerald-50">{fileName}</span>
                <span className="font-semibold text-orange-300">{pct >= 100 ? 'Concluído' : Math.round(pct) + '%'}</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/8" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da conversão">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-lime-300 to-orange-400 transition-all" style={{ width: pct + '%' }} />
              </div>
              <ol className="mt-5 grid gap-2 sm:grid-cols-5">
                {STEPS[fmt].map(([title, detail], i) => {
                  const done = i < active || pct >= 100, on = i === active && pct < 100
                  return (
                    <li key={title} className={cx('rounded-2xl border p-3 transition', on ? 'border-orange-300/40 bg-orange-400/10' : done ? 'border-emerald-300/25 bg-emerald-400/8' : 'border-white/8 bg-white/[0.03]')}>
                      <span className={cx('grid size-6 place-items-center rounded-full text-xs font-bold', done ? 'bg-emerald-400 text-ink' : on ? 'bg-orange-400 text-ink' : 'bg-white/10 text-emerald-100/60')}>{done ? '✓' : i + 1}</span>
                      <div className="mt-2 text-sm font-semibold text-white">{title}</div>
                      <div className="mt-0.5 text-xs text-emerald-100/55">{detail}</div>
                    </li>
                  )
                })}
              </ol>
            </div>
          )}
        </section>

        <section aria-label="Biblioteca" className="mt-10">
          <h2 className="font-display text-xl font-semibold text-white">Biblioteca</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {decks.map(d => (
              <article key={d.id} className="glass animate-fade-up flex flex-col rounded-3xl p-3">
                <div className="overflow-hidden rounded-2xl ring-1 ring-white/10"><Slide s={d.cover} /></div>
                <div className="flex items-start justify-between gap-2 px-2 pt-4">
                  <h3 className="font-display font-semibold leading-snug text-white">{d.title}</h3>
                  <Chip tone={d.ready ? 'green' : 'orange'}>{d.ready ? 'Pronta' : 'Processando'}</Chip>
                </div>
                <div className="px-2 pt-1 text-sm text-emerald-100/55">{d.slides} slides · {d.when}</div>
                <button onClick={() => setModal(d.title)} disabled={!d.ready} className={btn('accent', 'md', 'm-2 mt-4')}>Iniciar sessão ao vivo</button>
              </article>
            ))}
          </div>
        </section>
      </main>

      {modal && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setModal(null)}>
          <div role="dialog" aria-modal aria-label="Sessão criada" onClick={e => e.stopPropagation()} className="glass animate-fade-up w-full max-w-md rounded-[2rem] p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Chip tone="orange">Sala aberta</Chip>
                <h2 className="mt-2 font-display text-xl font-semibold text-white">{modal}</h2>
              </div>
              <button onClick={() => setModal(null)} aria-label="Fechar" className={btn('ghost', 'sm', 'size-8 px-0')}>✕</button>
            </div>
            <div className="mt-5 flex items-center gap-5">
              <QR className="w-36 shrink-0" />
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-emerald-100/55">PIN da sessão</div>
                <div className="mt-1 font-mono text-3xl font-medium tracking-[0.12em] text-orange-300">{PIN}</div>
                <p className="mt-2 text-xs text-emerald-100/60">O QR Code e o PIN ficam no canto do telão. O público entra sem cadastro.</p>
              </div>
            </div>
            <div className="glass-soft mt-5 space-y-4 rounded-2xl p-4">
              <Switch on={freeNav} onChange={() => setFreeNav(!freeNav)} label="Navegação livre" hint="O público pode voltar a slides anteriores para terminar notas" />
              <Switch on={moderation} onChange={() => setModeration(!moderation)} label="Moderar perguntas" hint="Perguntas passam por triagem antes de aparecer" />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Link to="/live" className={btn('ghost', 'md')}>Abrir telão</Link>
              <Link to="/live" className={btn('primary', 'md')}>Abrir console</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
