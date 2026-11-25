import { encode } from 'uqr'
import type { SlideData } from './data'
import { cx } from './ui'

/** 16:9 slide that scales its type with its own width (container query units). */
export function Slide({ s, className }: { s: SlideData; className?: string }) {
  return (
    <div className={cx('relative aspect-video w-full overflow-hidden rounded-[inherit] bg-[#062419] [container-type:inline-size]', className)}>
      <div aria-hidden className="absolute -right-[10%] -top-[30%] size-[60%] rounded-full bg-emerald-500/25 blur-[8cqw]" />
      <div aria-hidden className="absolute -bottom-[35%] -left-[10%] size-[55%] rounded-full bg-orange-500/20 blur-[8cqw]" />
      <div className="relative flex size-full flex-col p-[6%] text-[2.5cqw] leading-snug text-emerald-50">
        <Body s={s} />
      </div>
    </div>
  )
}

const H2 = ({ children }: { children: string }) => <h2 className="font-display text-[1.9em] font-bold leading-tight tracking-tight text-white">{children}</h2>

function Body({ s }: { s: SlideData }) {
  switch (s.kind) {
    case 'cover':
      return (
        <div className="my-auto">
          <div className="mb-[0.9em] h-[0.22em] w-[3em] rounded-full bg-gradient-to-r from-orange-400 to-orange-500" />
          <div className="text-[0.85em] font-semibold uppercase tracking-[0.12em] text-orange-300">{s.kicker}</div>
          <h1 className="mt-[0.4em] font-display text-[2.4em] font-bold leading-[1.05] tracking-tight text-white">{s.title}</h1>
          <p className="mt-[0.6em] max-w-[80%] text-[1.05em] text-emerald-100/75">{s.sub}</p>
          <div className="mt-[1.6em] text-[0.75em] text-emerald-100/55">{s.foot}</div>
        </div>
      )
    case 'section':
      return (
        <div className="my-auto">
          <div className="bg-gradient-to-r from-emerald-300 to-orange-400 bg-clip-text font-display text-[4.5em] font-bold leading-none text-transparent">{s.num}</div>
          <h2 className="mt-[0.2em] font-display text-[2.4em] font-bold tracking-tight text-white">{s.title}</h2>
        </div>
      )
    case 'bullets':
      return (
        <>
          <H2>{s.title}</H2>
          <div className="mt-[1.2em] flex flex-1 flex-col justify-center gap-[0.8em]">
            {s.bullets.map(b => (
              <div key={b} className="flex items-start gap-[0.7em] rounded-[0.6em] border border-white/10 bg-white/5 px-[0.8em] py-[0.55em] text-[1.05em]">
                <span className="mt-[0.45em] size-[0.45em] shrink-0 rounded-full bg-orange-400" />
                {b}
              </div>
            ))}
          </div>
        </>
      )
    case 'cap':
      return (
        <>
          <H2>{s.title}</H2>
          <div className="mt-[1em] flex flex-1 items-center gap-[1.5em]">
            <div role="img" aria-label="Diagrama de Venn com Consistência, Disponibilidade e Tolerância a partição" className="relative aspect-square w-[38%] shrink-0">
              {[['C', 'left-0 top-0 bg-emerald-400/35'], ['A', 'right-0 top-0 bg-orange-400/35'], ['P', 'bottom-0 left-[18%] bg-lime-300/30']].map(([l, pos]) => (
                <div key={l} className={cx('absolute grid size-[64%] place-items-center rounded-full border border-white/25 mix-blend-screen', pos)}>
                  <span className="font-display text-[1.6em] font-bold text-white">{l}</span>
                </div>
              ))}
            </div>
            <div className="space-y-[0.6em] text-[0.95em]">
              <p className="text-[1.1em] font-semibold text-white">{s.sub}</p>
              <div><b className="text-emerald-300">C</b> — toda leitura vê a escrita mais recente</div>
              <div><b className="text-orange-300">A</b> — toda requisição recebe resposta</div>
              <div><b className="text-lime-300">P</b> — o sistema segue funcionando apesar de partições</div>
            </div>
          </div>
        </>
      )
    case 'code':
      return (
        <>
          <H2>{s.title}</H2>
          <pre className="mt-[1em] overflow-hidden whitespace-pre-wrap rounded-[0.6em] border border-white/10 bg-black/40 p-[0.9em] font-mono text-[0.78em] leading-relaxed text-emerald-200">{s.code}</pre>
          <div className="mt-auto text-[0.85em] text-orange-200">As duas escritas acontecem juntas — ou nenhuma acontece.</div>
        </>
      )
    case 'compare':
      return (
        <>
          <H2>{s.title}</H2>
          <div className="mt-[1em] grid flex-1 grid-cols-2 gap-[1em]">
            {[{ ...s.left, c: 'text-emerald-300 border-emerald-300/30' }, { ...s.right, c: 'text-orange-300 border-orange-300/30' }].map(col => (
              <div key={col.h} className={cx('rounded-[0.7em] border bg-white/5 p-[0.9em]', col.c)}>
                <div className="mb-[0.6em] font-display text-[1.1em] font-bold">{col.h}</div>
                {col.items.map(it => <div key={it} className="border-t border-white/10 py-[0.4em] text-[0.95em] text-emerald-50">{it}</div>)}
              </div>
            ))}
          </div>
        </>
      )
    case 'end':
      return (
        <div className="m-auto text-center">
          <h2 className="font-display text-[3.4em] font-bold tracking-tight text-white">{s.title}</h2>
          <p className="mt-[0.3em] text-[1.2em] text-emerald-100/75">{s.sub}</p>
          <div className="mt-[1em] inline-block rounded-full border border-orange-300/40 bg-orange-400/15 px-[1em] py-[0.35em] font-mono text-[1.2em] font-medium tracking-[0.15em] text-orange-200">PIN {s.pin}</div>
        </div>
      )
  }
}

/** Real QR for `value`; without it, a decorative seeded fake for the demo screens. */
export function QR({ seed = 849201, value, className }: { seed?: number; value?: string; className?: string }) {
  if (value) {
    const m = encode(value, { border: 0 }).data
    return (
      <div role="img" aria-label="QR code para entrar na sessão" className={cx('grid aspect-square rounded-xl bg-white p-[6%]', className)} style={{ gridTemplateColumns: `repeat(${m.length}, 1fr)` }}>
        {m.flat().map((d, i) => <div key={i} className={d ? 'bg-ink' : ''} />)}
      </div>
    )
  }
  const N = 21
  let x = seed % 2147483647
  const rnd = () => (x = (x * 16807) % 2147483647) / 2147483647
  const finder = (r: number, c: number) => {
    for (const [or, oc] of [[0, 0], [0, N - 7], [N - 7, 0]]) {
      const rr = r - or, cc = c - oc
      if (rr >= -1 && rr <= 7 && cc >= -1 && cc <= 7) {
        if (rr < 0 || rr > 6 || cc < 0 || cc > 6) return 0
        if (rr === 0 || rr === 6 || cc === 0 || cc === 6) return 1
        return rr >= 2 && rr <= 4 && cc >= 2 && cc <= 4 ? 1 : 0
      }
    }
    return -1
  }
  const cells: boolean[] = []
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const f = finder(r, c)
    cells.push(f !== -1 ? f === 1 : r === 6 ? c % 2 === 0 : c === 6 ? r % 2 === 0 : rnd() < 0.48)
  }
  return (
    <div role="img" aria-label="QR code para entrar na sessão" className={cx('grid aspect-square rounded-xl bg-white p-[6%]', className)} style={{ gridTemplateColumns: `repeat(${N}, 1fr)` }}>
      {cells.map((d, i) => <div key={i} className={d ? 'bg-ink' : ''} />)}
    </div>
  )
}
