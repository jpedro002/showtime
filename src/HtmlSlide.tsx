import { useEffect, useMemo, useRef, useState } from 'react'
import { imgUrl, type HtmlDeck } from './decks'
import { cx } from './ui'

const W = 1920, H = 1080 // shortcut: 16:9 only; read deck.json `size` when a 4:3 deck is imported

// Lucide-style 24px stroke icons, used as masks so `color` paints them.
const ICON: Record<string, string> = {
  Check: "<path d='M20 6 9 17l-5-5'/>",
  Search: "<circle cx='11' cy='11' r='8'/><path d='m21 21-4.3-4.3'/>",
  Warning: "<path d='m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3'/><path d='M12 9v4M12 17h.01'/>",
  PaperPlane: "<path d='M14.54 21.69a.5.5 0 0 0 .94-.03l6.5-19a.5.5 0 0 0-.64-.63l-19 6.5a.5.5 0 0 0-.02.93l7.93 3.18a2 2 0 0 1 1.11 1.11zM21.85 2.15 10.91 13.09'/>",
  Tool: "<path d='M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z'/>",
}
const arrow = (pts: string) => `clip-path:polygon(${pts})`

// What the Slides format gives every deck that a browser doesn't: tag defaults and the x-shape / x-icon elements.
// shortcut: only the icons used so far and no <x-connector>; add them when a deck needs them.
const BASE = `html,body{margin:0;background:transparent;overflow:hidden}
section{position:relative;width:${W}px;height:${H}px;box-sizing:border-box;overflow:hidden}
aside{display:none}
h1,h2,h3,p{margin:0}h1{font-size:96px;font-weight:600}h2{font-size:64px;font-weight:600}h3{font-size:44px;font-weight:600}p{font-size:32px}
table{border-collapse:collapse}th,td{padding:.35em .6em;text-align:left;border-bottom:1px solid color-mix(in srgb,currentColor 22%,transparent)}
x-shape,x-icon{display:block;flex:none}x-shape{background:currentColor}
x-shape[kind=rounded]{border-radius:24px}x-shape[kind=ellipse]{border-radius:50%}
x-shape[kind=diamond]{${arrow('50% 0,100% 50%,50% 100%,0 50%')}}
x-shape[kind=arrow-down]{${arrow('30% 0,70% 0,70% 60%,100% 60%,50% 100%,0 60%,30% 60%')}}
x-shape[kind=arrow-up]{${arrow('50% 0,100% 40%,70% 40%,70% 100%,30% 100%,30% 40%,0 40%')}}
x-shape[kind=arrow-right]{${arrow('0 30%,60% 30%,60% 0,100% 50%,60% 100%,60% 70%,0 70%')}}
x-shape[kind=arrow-left]{${arrow('0 50%,40% 0,40% 30%,100% 30%,100% 70%,40% 70%,40% 100%')}}
x-icon{width:1em;height:1em;background:currentColor;mask:var(--m) center/contain no-repeat}
${Object.entries(ICON).map(([n, p]) => `x-icon[name=${n}]{--m:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>${p}</svg>")}`).join('\n')}`

// The iframe runs no script (sandbox) and the CSP blocks every request but Google Fonts, so a deck can't phone home.
const CSP = "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data:"
const FONT = /^https:\/\/fonts\.googleapis\.com\/css2\?[^"<>]*$/
const srcDoc = (deck: HtmlDeck, html: string) => `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}">`
  + deck.fonts.filter(f => FONT.test(f)).map(f => `<link rel="stylesheet" href="${f.replace(/&(?!amp;)/g, '&amp;')}">`).join('')
  + `<style>${BASE}</style><style>${deck.css.replace(/<\/style/gi, '')}</style>${html}`

/** reveal.js order: fragments with data-fragment-index first (lowest first, one index = one click), then the rest in file order. */
function fragmentSteps(root: ParentNode) {
  const all = [...root.querySelectorAll<HTMLElement>('.fragment')]
  const byIndex = new Map<number, HTMLElement[]>()
  for (const e of all) {
    const i = Number(e.dataset.fragmentIndex)
    if (e.dataset.fragmentIndex && !isNaN(i)) byIndex.set(i, [...(byIndex.get(i) ?? []), e])
  }
  return [...[...byIndex].sort((a, b) => a[0] - b[0]).map(([, g]) => g), ...all.filter(e => !e.dataset.fragmentIndex).map(e => [e])]
}

/** Clicks a slide holds before the next one: one per fragment step. */
export const countSteps = (html: string) => fragmentSteps(new DOMParser().parseFromString(html, 'text/html')).length

function showSteps(doc: Document | null | undefined, step: number) {
  if (!doc) return
  fragmentSteps(doc).forEach((g, i) => g.forEach(e => {
    e.classList.toggle('visible', i < step)
    e.classList.toggle('current-fragment', i === step - 1)
  }))
}

/**
 * One slide of an HTML deck, scaled to its box. Each slide is a fresh document, so its CSS and SVG animations
 * play on arrival; `step` reveals fragments; a slide with data-transition fades into the next.
 * shortcut: push/magic transitions also fade.
 */
export function HtmlSlide({ deck, idx, step = 0, className }: { deck: HtmlDeck; idx: number; step?: number; className?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const cur = useRef<HTMLIFrameElement>(null)
  const [k, setK] = useState(0)
  const [shown, setShown] = useState<number | null>(null) // last slide whose document finished loading
  const [prev, setPrev] = useState<number | null>(null) // slide fading out under the current one
  const [last, setLast] = useState(idx)
  if (idx !== last) { setLast(idx); setPrev(shown === last ? last : prev) }

  const docs = useMemo(() => deck.slides.map(s => srcDoc(deck, s.html)), [deck])
  const fades = (i: number | null) => i !== null && /data-transition="(fade|push|magic)"/.test(deck.slides[i]?.html ?? '')

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setK(e.contentRect.width / W))
    ro.observe(box.current!)
    return () => ro.disconnect()
  }, [])
  useEffect(() => { showSteps(cur.current?.contentDocument, step) }, [step, shown])

  const onLoad = (i: number, f: HTMLIFrameElement) => {
    if (i !== idx) return
    showSteps(f.contentDocument, step)
    setShown(i)
    if (!fades(prev)) setPrev(null)
  }

  return (
    <div ref={box} className={cx('relative aspect-video w-full overflow-hidden rounded-[inherit]', className)}>
      {(prev !== null && prev !== idx ? [prev, idx] : [idx]).map(i => (
        <iframe key={i} ref={i === idx ? cur : undefined} srcDoc={docs[i]} title={deck.slides[i]?.title || `Slide ${i + 1}`}
          sandbox="allow-same-origin" tabIndex={-1} onLoad={e => onLoad(i, e.currentTarget)}
          onTransitionEnd={() => i === idx && setPrev(null)}
          className="pointer-events-none absolute left-0 top-0 origin-top-left border-0"
          style={{ width: W, height: H, transform: `scale(${k})`, opacity: i === idx && shown !== idx ? 0 : 1, transition: fades(prev) ? 'opacity 500ms' : 'none' }} />
      ))}
    </div>
  )
}

/** Any deck slide: HTML in a sandboxed iframe, or the uploaded WebP (`small` picks the phone-size image). */
export function DeckSlide({ deck, idx, step, small, className }: { deck: HtmlDeck; idx: number; step?: number; small?: boolean; className?: string }) {
  const s = deck.slides[idx]
  if (!s?.stage) return <HtmlSlide deck={deck} idx={idx} step={step} className={className} />
  return <img src={imgUrl(small && s.mobile ? s.mobile : s.stage)} alt={s.title || `Slide ${idx + 1}`} draggable={false}
    className={cx('aspect-video w-full rounded-[inherit] bg-black object-contain', className)} />
}
