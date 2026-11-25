import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { DECK, DECK_TITLE } from '../data'
import { Slide } from '../Slide'
import { btn, cx, Segmented, Toast } from '../ui'

const NOTES: Record<number, string> = {
  2: 'Escala horizontal > vertical\n— tolerância a falhas\n— latência por região',
  3: 'P não é opcional! Em partição: escolher C ou A.',
  4: 'Shards → somar na leitura.\nIncremento atômico sempre no servidor.',
  6: 'Tempo real cobra por banda; documento cobra por operação.\nNotas pessoais = zero fan-out.',
  9: 'Chave de idempotência por operação, não por usuário.',
}
const MY_QS = [{ slide: 6, text: 'Vale a pena usar CRDTs para notas colaborativas?' }]
const TOP_QS = [{ slide: 4, text: 'Como evitar hotspotting em contadores distribuídos?', votes: 58 }, { slide: 3, text: 'O teorema CAP ainda vale com redes modernas de baixa latência?', votes: 34 }]

function Check({ on, onChange, children }: { on: boolean; onChange: () => void; children: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-sm text-emerald-50 hover:bg-white/5">
      <input type="checkbox" checked={on} onChange={onChange} className="size-4 accent-emerald-400" />{children}
    </label>
  )
}

export default function Apostila() {
  const [fmt, setFmt] = useState<'pdf' | 'md'>('pdf')
  const [layout, setLayout] = useState<'side' | 'stack'>('side')
  const [allSlides, setAll] = useState(false)
  const [myQs, setMyQs] = useState(true)
  const [topQs, setTopQs] = useState(true)
  const [linked, setLinked] = useState(false)
  const [toast, setToast] = useState('')
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3000); return () => clearTimeout(t) }, [toast])

  const rows = DECK.map((d, i) => {
    const qs = [
      ...(myQs ? MY_QS.filter(q => q.slide === i).map(q => ({ tag: 'Sua pergunta:', text: q.text })) : []),
      ...(topQs ? TOP_QS.filter(q => q.slide === i).map(q => ({ tag: `Mais votada (${q.votes}):`, text: q.text })) : []),
    ]
    return { slide: d, n: i + 1, note: NOTES[i] ?? '', qs }
  }).filter(r => allSlides || r.note || r.qs.length)

  let md = `# ${DECK_TITLE}\n_[SEU NOME] · [EVENTO] · [DATA]_\n`
  for (const r of rows) {
    md += `\n## Slide ${r.n} — ${r.slide.title}\n![Slide ${r.n}](slides/slide_${r.n - 1}_mob.webp)\n\n${r.note ? r.note + '\n' : '_Sem anotações._\n'}`
    for (const q of r.qs) md += `\n> **${q.tag}** ${q.text}\n`
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8 lg:py-10">
      <header>
        <Link to="/live" className={btn('quiet', 'sm', '-ml-3')}>← Voltar para a sessão</Link>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">Sua apostila da palestra</h1>
        <p className="mt-2 text-emerald-100/65">Cada slide ao lado das notas que você fez nele.</p>
      </header>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[320px_1fr]">
        <aside aria-label="Opções de exportação" className="space-y-4 lg:sticky lg:top-6">
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
              <Check on={allSlides} onChange={() => setAll(!allSlides)}>Slides sem nota</Check>
              <Check on={myQs} onChange={() => setMyQs(!myQs)}>Minhas perguntas</Check>
              <Check on={topQs} onChange={() => setTopQs(!topQs)}>Perguntas mais votadas da sala</Check>
            </div>
            <button className={btn('primary', 'lg', 'w-full')}
              onClick={() => setToast(fmt === 'pdf' ? 'apostila-sistemas-distribuidos.pdf gerada no seu aparelho.' : 'notas-sistemas-distribuidos.md gerado no seu aparelho.')}>
              ↓ {fmt === 'pdf' ? 'Baixar apostila (.pdf)' : 'Baixar notas (.md)'}
            </button>
          </div>

          <div className={cx('glass rounded-[2rem] p-5', linked ? 'border-emerald-300/30' : 'border-orange-300/30')}>
            {linked ? (
              <>
                <div className="font-display font-semibold text-emerald-300">✓ Notas salvas na sua conta</div>
                <p className="mt-1 text-sm text-emerald-100/65">Esta palestra entrou no seu histórico de eventos. Você pode reabrir a apostila quando quiser.</p>
              </>
            ) : (
              <>
                <div className="font-display font-semibold text-orange-300">Não perca suas notas</div>
                <p className="mt-1 text-sm text-emerald-100/65">Você entrou como anônimo. Vincule uma conta Google e as notas desta e das próximas palestras ficam guardadas no seu histórico — nada é perdido na troca.</p>
                <button onClick={() => setLinked(true)} className={btn('accent', 'md', 'mt-4 w-full')}>Salvar na minha conta Google</button>
              </>
            )}
          </div>
        </aside>

        <section aria-label="Pré-visualização">
          <div className="mb-3 text-sm font-medium text-emerald-100/60">Pré-visualização · {rows.length} {rows.length === 1 ? 'slide' : 'slides'}</div>
          {fmt === 'pdf' ? (
            <div className="rounded-[2rem] bg-[#f6fbf8] p-5 text-ink shadow-[0_40px_80px_-30px_rgb(0_0_0/0.8)] sm:p-10">
              <div className="border-b border-ink/10 pb-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-orange-600">Apostila · [EVENTO] · [DATA]</div>
                <h2 className="mt-1 font-display text-2xl font-bold tracking-tight">{DECK_TITLE}</h2>
                <div className="text-sm text-ink/60">[SEU NOME]</div>
              </div>
              {rows.map(r => (
                <div key={r.n} className={cx('flex gap-5 border-b border-ink/10 py-5 last:border-0', layout === 'side' ? 'flex-col sm:flex-row' : 'flex-col')}>
                  <div className={cx('shrink-0 overflow-hidden rounded-xl', layout === 'side' ? 'sm:w-[300px]' : 'w-full')}><Slide s={r.slide} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">Slide {r.n} · {r.slide.title}</div>
                    {r.note ? <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{r.note}</p> : <p className="mt-2 text-sm italic text-ink/45">Sem anotações.</p>}
                    {r.qs.map(q => <div key={q.text} className="mt-3 rounded-lg border-l-4 border-orange-500 bg-orange-50 px-3 py-2 text-sm"><strong>{q.tag}</strong> {q.text}</div>)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <pre className="glass overflow-x-auto whitespace-pre-wrap rounded-[2rem] p-6 font-mono text-[13px] leading-relaxed text-emerald-100">{md}</pre>
          )}
        </section>
      </div>
      <Toast msg={toast} />
    </div>
  )
}
