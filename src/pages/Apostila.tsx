import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { useSession } from '../Auth'
import { DECK, DECK_TITLE } from '../data'
import { fetchDeck, type HtmlDeck } from '../decks'
import { DeckSlide } from '../HtmlSlide'
import { Slide } from '../Slide'
import { supabase } from '../supabase'
import { btn, Check, cx, Segmented, Toast } from '../ui'

type Q = { slide: number; text: string; votes?: number }
/** Everything the handout shows; `deck` null = demo slides from data.ts. */
type Handout = { deck: HtmlDeck | null; title: string; date: string; slides: string[]; notes: Record<number, string>; myQs: Q[]; topQs: Q[] }

const DEMO: Handout = {
  deck: null, title: DECK_TITLE, date: '[EVENTO] · [DATA]', slides: DECK.map(d => d.title),
  notes: {
    2: 'Escala horizontal > vertical\n— tolerância a falhas\n— latência por região',
    3: 'P não é opcional! Em partição: escolher C ou A.',
    4: 'Shards → somar na leitura.\nIncremento atômico sempre no servidor.',
    6: 'Tempo real cobra por banda; documento cobra por operação.\nNotas pessoais = zero fan-out.',
    9: 'Chave de idempotência por operação, não por usuário.',
  },
  myQs: [{ slide: 6, text: 'Vale a pena usar CRDTs para notas colaborativas?' }],
  topQs: [{ slide: 4, text: 'Como evitar hotspotting em contadores distribuídos?', votes: 58 }, { slide: 3, text: 'O teorema CAP ainda vale com redes modernas de baixa latência?', votes: 34 }],
}

async function load(id: string, uid: string): Promise<Handout> {
  const { data: s, error } = await supabase.from('sessions').select('id, deck_id, started_at, status').eq('id', id).maybeSingle()
  if (error) throw error
  if (!s) throw new Error('Sessão não encontrada, ou você não participou dela.')
  const [deck, notes, mine, top] = await Promise.all([
    fetchDeck(s.deck_id),
    supabase.from('notes').select('slide, body').eq('session_id', id).eq('user_id', uid),
    supabase.from('questions').select('slide, text, status').eq('session_id', id).eq('author_id', uid),
    supabase.from('questions').select('slide, text, upvote_count').eq('session_id', id).eq('status', 'approved')
      .order('upvote_count', { ascending: false }).limit(10),
  ])
  const err = notes.error ?? mine.error ?? top.error
  if (err) throw err
  return {
    deck, title: deck.title, slides: deck.slides.map(x => x.title), // slides[].notes are speaker notes: never shown here
    date: new Date(s.started_at).toLocaleDateString('pt-BR', { dateStyle: 'long' }),
    notes: Object.fromEntries(notes.data!.map(n => [n.slide, n.body.trim()])),
    myQs: mine.data!,
    topQs: top.data!.filter(q => q.upvote_count > 0).map(q => ({ slide: q.slide, text: q.text, votes: q.upvote_count })),
  }
}

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'apostila'

function download(text: string, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000) // Safari aborts the download if revoked synchronously
}

// Only the paper prints: App's global <Backdrop/> (aria-hidden child of #root) and the dark page background go away.
const PRINT_CSS = `@media print {
  @page { margin: 14mm }
  html, body { background: #fff !important }
  #root > [aria-hidden="true"] { display: none !important }
}`

function Msg({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <section className="glass animate-fade-up w-full max-w-sm rounded-[2rem] p-8 text-center text-emerald-100/80">{children}</section>
    </main>
  )
}

export default function Apostila() {
  const { sessionId } = useParams()
  const session = useSession()
  const uid = session?.user.id
  const [res, setRes] = useState<{ id: string; data?: Handout; error?: string }>()
  const [fmt, setFmt] = useState<'pdf' | 'md'>('pdf')
  const [layout, setLayout] = useState<'side' | 'stack'>('side')
  const [allSlides, setAll] = useState(false)
  const [myQs, setMyQs] = useState(true)
  const [topQs, setTopQs] = useState(true)
  const [demoLinked, setDemoLinked] = useState(false)
  const [linkErr, setLinkErr] = useState('')
  const [toast, setToast] = useState('')
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3000); return () => clearTimeout(t) }, [toast])
  useEffect(() => {
    if (!sessionId || !uid) return
    let on = true
    load(sessionId, uid).then(
      data => on && setRes({ id: sessionId, data }),
      e => on && setRes({ id: sessionId, error: e?.message ?? String(e) }))
    return () => { on = false }
  }, [sessionId, uid])

  const back = sessionId ? `/watch/${sessionId}` : '/live'
  if (sessionId) {
    if (session === undefined) return <Msg>Carregando…</Msg>
    if (!session) return <Msg><p>Entre na sessão para ver sua apostila.</p><Link to="/join" className={btn('primary', 'md', 'mt-5')}>Entrar com o PIN</Link></Msg>
    if (res?.id === sessionId && res.error) return <Msg><p className="text-rose-200">Não foi possível montar a apostila.</p><p className="mt-1 text-sm">{res.error}</p><Link to={back} className={btn('ghost', 'md', 'mt-5')}>← Voltar à apresentação</Link></Msg>
  }
  const data = sessionId ? (res?.id === sessionId ? res.data : undefined) : DEMO
  if (!data) return <Msg>Montando sua apostila…</Msg>

  const saved = sessionId ? session?.user.is_anonymous === false : demoLinked
  const linkGoogle = async () => {
    if (!sessionId) return setDemoLinked(true)
    setLinkErr('')
    const { error } = await supabase.auth.linkIdentity({ provider: 'google', options: { redirectTo: location.href } })
    if (error) setLinkErr(error.message)
  }

  const rows = data.slides.map((title, i) => {
    const mine = myQs ? data.myQs.filter(q => q.slide === i) : []
    const qs = [
      ...mine.map(q => ({ tag: 'Sua pergunta:', text: q.text })),
      ...(topQs ? data.topQs.filter(q => q.slide === i && !mine.some(m => m.text === q.text)).map(q => ({ tag: `Mais votada (${q.votes}):`, text: q.text })) : []),
    ]
    return { i, n: i + 1, title, note: data.notes[i] ?? '', qs }
  }).filter(r => allSlides || r.note || r.qs.length)

  let md = `# ${data.title}\n_Apostila · ${data.date}_\n`
  for (const r of rows) {
    md += `\n## Slide ${r.n}${r.title ? ` — ${r.title}` : ''}\n\n${r.note ? r.note.replace(/\n/g, '  \n') : '_Sem anotações._'}\n`
    for (const q of r.qs) md += `\n> **${q.tag}** ${q.text}\n`
  }

  const exportIt = () => {
    if (fmt === 'pdf') return window.print()
    download(md, `notas-${slug(data.title)}.md`)
    setToast(`notas-${slug(data.title)}.md baixado no seu aparelho.`)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8 lg:py-10 print:max-w-none print:p-0">
      <style>{PRINT_CSS}</style>
      <header className="print:hidden">
        <Link to={back} className={btn('quiet', 'sm', '-ml-3')}>← Voltar à apresentação</Link>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">Sua apostila da palestra</h1>
        <p className="mt-2 text-emerald-100/65">Cada slide ao lado das notas que você fez nele.</p>
      </header>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[320px_1fr] print:mt-0 print:block">
        <aside aria-label="Opções de exportação" className="space-y-4 lg:sticky lg:top-6 print:hidden">
          <div className="glass space-y-5 rounded-[2rem] p-5">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-100/55">Formato</div>
              <Segmented label="Formato" value={fmt} onChange={setFmt} options={[{ v: 'pdf', label: 'PDF' }, { v: 'md', label: 'Markdown' }]} />
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-100/55">Layout</div>
              <Segmented label="Layout" value={layout} onChange={setLayout} options={[{ v: 'side', label: 'Lado a lado' }, { v: 'stack', label: 'Slide acima' }]} />
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-100/55">Incluir</div>
              <Check on={allSlides} onChange={setAll} className="rounded-xl px-2 py-1.5 text-emerald-50 hover:bg-white/5">Slides sem nota</Check>
              <Check on={myQs} onChange={setMyQs} className="rounded-xl px-2 py-1.5 text-emerald-50 hover:bg-white/5">Minhas perguntas</Check>
              <Check on={topQs} onChange={setTopQs} className="rounded-xl px-2 py-1.5 text-emerald-50 hover:bg-white/5">Perguntas mais votadas da sala</Check>
            </div>
            <button className={btn('primary', 'lg', 'w-full')} onClick={exportIt}>
              ↓ {fmt === 'pdf' ? 'Baixar apostila (.pdf)' : 'Baixar notas (.md)'}
            </button>
            {fmt === 'pdf' && <p className="text-xs text-emerald-100/55">Abre a impressão do navegador: escolha “Salvar como PDF”.</p>}
          </div>

          <div className={cx('glass rounded-[2rem] p-5', saved ? 'border-emerald-300/30' : 'border-orange-300/30')}>
            {saved ? (
              <>
                <div className="font-display font-semibold text-emerald-300">✓ Salvo na sua conta</div>
                <p className="mt-1 text-sm text-emerald-100/65">Esta palestra entrou no seu histórico de eventos. Você pode reabrir a apostila quando quiser.</p>
              </>
            ) : (
              <>
                <div className="font-display font-semibold text-orange-300">Não perca suas notas</div>
                <p className="mt-1 text-sm text-emerald-100/65">Você entrou como anônimo. Vincule uma conta Google e as notas desta e das próximas palestras ficam guardadas no seu histórico — nada é perdido na troca.</p>
                <button onClick={linkGoogle} className={btn('accent', 'md', 'mt-4 w-full')}>Salvar na minha conta Google</button>
                {linkErr && <p role="alert" className="mt-3 text-sm text-rose-200">{linkErr}</p>}
              </>
            )}
          </div>
        </aside>

        <section aria-label="Pré-visualização">
          <div className="mb-3 text-sm font-medium text-emerald-100/60 print:hidden">Pré-visualização · {rows.length} {rows.length === 1 ? 'slide' : 'slides'}</div>
          {fmt === 'pdf' ? (
            <div className="rounded-[2rem] bg-[#f6fbf8] p-5 text-ink shadow-[0_40px_80px_-30px_rgb(0_0_0/0.8)] [print-color-adjust:exact] sm:p-10 print:rounded-none print:bg-white print:p-0 print:shadow-none">
              <div className="border-b border-ink/10 pb-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-orange-600">Apostila · {data.date}</div>
                <h2 className="mt-1 font-display text-2xl font-bold tracking-tight">{data.title}</h2>
              </div>
              {!rows.length && <p className="py-8 text-center text-sm italic text-ink/50">Nenhuma anotação ou pergunta. Marque “Slides sem nota” para incluir todos os slides.</p>}
              {rows.map(r => (
                <div key={r.n} className={cx('flex break-inside-avoid gap-5 border-b border-ink/10 py-5 last:border-0', layout === 'side' ? 'flex-col sm:flex-row' : 'flex-col')}>
                  {/* stack layout capped at max-w-xl so an HTML slide's screen-time scale still fits the printed page */}
                  <div className={cx('shrink-0 overflow-hidden rounded-xl', layout === 'side' ? 'sm:w-[300px]' : 'w-full max-w-xl')}>
                    {data.deck ? <DeckSlide deck={data.deck} idx={r.i} small /> : <Slide s={DECK[r.i]} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">Slide {r.n}{r.title && ` · ${r.title}`}</div>
                    {r.note ? <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{r.note}</p> : <p className="mt-2 text-sm italic text-ink/45">Sem anotações.</p>}
                    {r.qs.map((q, k) => <div key={k} className="mt-3 rounded-lg border-l-4 border-orange-500 bg-orange-50 px-3 py-2 text-sm"><strong>{q.tag}</strong> {q.text}</div>)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <pre className="glass overflow-x-auto whitespace-pre-wrap rounded-[2rem] p-6 font-mono text-[13px] leading-relaxed text-emerald-100">{md}</pre>
          )}
        </section>
      </div>
      <div className="print:hidden"><Toast msg={toast} /></div>
    </div>
  )
}
