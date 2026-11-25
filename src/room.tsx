import { useEffect, useMemo, useRef, useState } from 'react'
import type { Question } from './data'
import { DECK, PIN, POLL, SEED_Q } from './data'
import type { HtmlDeck } from './decks'
import { countSteps, HtmlSlide } from './HtmlSlide'
import { QR, Slide } from './Slide'
import { Bar, Chip, cx } from './ui'

export type Kind = 'fogo' | 'palmas' | 'uau'
export const EMOJI: Record<Kind, string> = { fogo: '🔥', palmas: '👏', uau: '😮' }
export const R_BG: Record<Kind, string> = { fogo: 'from-orange-400 to-orange-600', palmas: 'from-emerald-300 to-emerald-500', uau: 'from-lime-200 to-lime-400' }
export const N = DECK.length
export const TOTAL_SEC = 45 * 60
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export const pad = (n: number) => String(n).padStart(2, '0')
const byRank = (a: Question, b: Question) => Number(a.answered) - Number(b.answered) || b.votes - a.votes

type Poll = { status: 'idle' | 'open' | 'closed'; onStage: boolean; myVote: number | null; votes: number[] }
export type S = {
  cur: number; step: number; follow: boolean; audView: number; tab: 'notas' | 'qa' | 'poll'
  notes: Record<number, string>; draft: string; anon: boolean; cooldown: number; nextId: number
  questions: Question[]; pinned: string | null; moderation: boolean
  reacts: { id: number; kind: Kind; left: number; born: number }[]; rId: number; totals: Record<Kind, number>
  poll: Poll; elapsed: number; online: number; showQr: boolean; badge: Badge
}
export const IDLE_POLL: Poll = { status: 'idle', onStage: false, myVote: null, votes: [0, 0, 0, 0] }
const INIT: S = {
  cur: 4, step: 0, follow: true, audView: 4, tab: 'notas',
  notes: { 2: 'Escala horizontal > vertical\n— tolerância a falhas\n— latência por região', 3: 'P não é opcional! Em partição: escolher C ou A.' },
  draft: '', anon: true, cooldown: 0, nextId: 100, questions: SEED_Q, pinned: null, moderation: true,
  reacts: [], rId: 0, totals: { fogo: 128, palmas: 96, uau: 41 }, poll: IDLE_POLL, elapsed: 18 * 60 + 32, online: 287, showQr: true, badge: { x: 1, y: 0 },
}

const addReact = (s: S, kind: Kind) => ({ reacts: [...s.reacts, { id: s.rId, kind, left: 6 + Math.random() * 82, born: Date.now() }], rId: s.rId + 1 })

/** One simulated second of a live room. */
function tick(s: S): Partial<S> {
  const e = s.elapsed + 1, now = Date.now()
  let p: Partial<S> = { elapsed: e, cooldown: Math.max(0, s.cooldown - 1), reacts: s.reacts.filter(r => now - r.born < 2900) }
  if (Math.random() < 0.4) p = { ...p, ...addReact({ ...s, reacts: p.reacts! }, (['fogo', 'palmas', 'uau'] as const)[Math.floor(Math.random() * 3)]) }
  if (e % 3 === 0) p.online = clamp(s.online + Math.round(Math.random() * 8 - 4), 250, 320)
  if (e % 4 === 0) {
    const pool = s.questions.filter(q => q.status === 'approved' && !q.answered).sort((a, b) => b.votes - a.votes).slice(0, 3)
    const pick = pool[Math.floor(Math.random() * pool.length)]
    if (pick) p.questions = s.questions.map(q => (q.id === pick.id ? { ...q, votes: q.votes + 1 } : q))
  }
  if (s.poll.status === 'open') {
    const votes = [...s.poll.votes], w = [0.46, 0.3, 0.14, 0.1]
    for (let n = 1 + Math.floor(Math.random() * 4); n > 0; n--) {
      let x = Math.random()
      const j = w.findIndex(wi => (x -= wi) < 0)
      votes[j < 0 ? 3 : j]++
    }
    p.poll = { ...s.poll, votes }
  }
  return p
}

/** Simulated live session, shared by the demo (/live) and the presenter console (/presenter). Without `deck` it shows the demo deck. */
export function useRoom(deck?: HtmlDeck) {
  const [s, setS] = useState(deck ? { ...INIT, cur: 0, audView: 0, notes: {} } : INIT)
  const n = deck ? deck.slides.length : N
  const steps = useMemo(() => deck?.slides.map(x => countSteps(x.html)) ?? [], [deck])
  const up = (f: (s: S) => Partial<S>) => setS(prev => ({ ...prev, ...f(prev) }))
  const [toast, setToast] = useState('')
  const [saving, setSaving] = useState(false)
  const saveT = useRef(0)

  useEffect(() => { const iv = setInterval(() => up(tick), 1000); return () => clearInterval(iv) }, [])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2600); return () => clearTimeout(t) }, [toast])
  useEffect(() => () => clearTimeout(saveT.current), [])

  // Derived state
  const eff = s.follow ? s.cur : Math.min(s.audView, s.cur)
  const approved = s.questions.filter(q => q.status === 'approved').sort(byRank)
  const pending = s.questions.filter(q => q.status === 'pending')
  const hidden = s.questions.filter(q => q.status === 'hidden')
  const audQs = s.questions.filter(q => q.status === 'approved' || (q.mine && q.status === 'pending')).sort(byRank)
  const hot = approved.find(q => !q.answered && q.votes >= 30 && s.pinned !== q.id)
  const pinnedQ = s.questions.find(q => q.id === s.pinned && q.status === 'approved')
  const total = s.poll.votes.reduce((a, b) => a + b, 0)
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0)
  const pollLabel = s.poll.status === 'idle' ? 'Pronta para lançar' : `${s.poll.status === 'open' ? 'Votação aberta' : 'Encerrada'} · ${total} votos`
  const timeFrac = Math.min(1, s.elapsed / TOTAL_SEC)
  const timer = `${pad(Math.floor(s.elapsed / 60))}:${pad(s.elapsed % 60)}`

  // Actions
  const go = (i: number) => up(() => ({ cur: clamp(i, 0, n - 1), step: 0 }))
  // The clicker reveals a slide's fragments one by one before moving on; going back shows them all.
  const next = () => up(p => (p.step < (steps[p.cur] ?? 0) ? { step: p.step + 1 } : p.cur < n - 1 ? { cur: p.cur + 1, step: 0 } : {}))
  const back = () => up(p => (p.step > 0 ? { step: p.step - 1 } : p.cur > 0 ? { cur: p.cur - 1, step: steps[p.cur - 1] ?? 0 } : {}))
  const audGo = (i: number) => up(p => (i < 0 || i > p.cur ? {} : i === p.cur ? { follow: true } : { follow: false, audView: i }))
  const mapQ = (id: string, f: (q: Question) => Partial<Question>) => up(p => ({ questions: p.questions.map(q => (q.id === id ? { ...q, ...f(q) } : q)) }))
  const vote = (id: string) => mapQ(id, q => ({ voted: !q.voted, votes: q.votes + (q.voted ? -1 : 1) }))
  const answer = (id: string) => mapQ(id, q => ({ answered: !q.answered }))
  const pin = (id: string) => up(p => ({ pinned: p.pinned === id ? null : id }))
  const setStatus = (id: string, status: Question['status']) => {
    mapQ(id, () => ({ status }))
    if (status === 'hidden') up(p => (p.pinned === id ? { pinned: null } : {}))
  }
  const merge = (id: string) => up(p => {
    const src = p.questions.find(q => q.id === id)
    if (!src?.dupOf) return {}
    return { questions: p.questions.map(q => (q.id === id ? { ...q, status: 'merged' as const } : q.id === src.dupOf ? { ...q, votes: q.votes + src.votes + 1 } : q)) }
  })
  const react = (k: Kind) => up(p => ({ ...addReact(p, k), totals: { ...p.totals, [k]: p.totals[k] + 1 } }))
  const sendQ = () => {
    const t = s.draft.trim()
    if (!t || t.length > 280 || s.cooldown > 0) return
    const status = s.moderation ? 'pending' : 'approved'
    up(p => ({
      questions: [...p.questions, { id: 'q' + p.nextId, text: t, author: p.anon ? 'Anônimo' : 'Você', slide: eff, votes: 0, voted: false, status, answered: false, mine: true }],
      draft: '', cooldown: 20, nextId: p.nextId + 1,
    }))
    setToast(status === 'pending' ? 'Pergunta enviada para a moderação.' : 'Pergunta publicada.')
  }
  const onNote = (v: string) => {
    up(p => ({ notes: { ...p.notes, [eff]: v } }))
    setSaving(true)
    clearTimeout(saveT.current)
    saveT.current = window.setTimeout(() => setSaving(false), 800)
  }
  const pickPoll = (i: number) => up(p => (p.poll.status !== 'open' || p.poll.myVote !== null ? {} : { poll: { ...p.poll, myVote: i, votes: p.poll.votes.map((v, j) => (j === i ? v + 1 : v)) } }))

  // Clicker / keyboard shortcuts (ignored while typing).
  const keyRef = useRef<(e: KeyboardEvent) => void>(null)
  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('input, textarea')) return
    const k = e.key
    if (k === 'ArrowRight' || k === 'PageDown') { e.preventDefault(); next() }
    else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); back() }
    else if (k === 'p' || k === 'P') up(p => ({ pinned: p.questions.filter(q => q.status === 'approved' && !q.answered && q.id !== p.pinned).sort((a, b) => b.votes - a.votes)[0]?.id ?? null }))
    else if (k === 'q' || k === 'Q') up(p => ({ showQr: !p.showQr }))
  }
  useEffect(() => { keyRef.current = onKey })
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current?.(e)
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const launchPoll = () => up(() => ({ poll: { ...IDLE_POLL, status: 'open', onStage: true } }))
  const closePoll = () => up(p => ({ poll: { ...p.poll, status: 'closed' } }))
  const newPoll = () => up(() => ({ poll: IDLE_POLL }))
  const togglePollStage = () => up(p => ({ poll: { ...p.poll, onStage: !p.poll.onStage } }))

  return {
    deck, n, steps, s, up, toast, saving, eff, approved, pending, hidden, audQs, hot, pinnedQ, total, pct, pollLabel, timeFrac, timer,
    go, next, back, audGo, vote, answer, pin, setStatus, merge, react, sendQ, onNote, pickPoll, launchPoll, closePoll, newPoll, togglePollStage,
  }
}
export type Room = ReturnType<typeof useRoom>

/** Slide i of the room's deck (HTML deck or demo). */
export function SlideAt({ r, i, step = 0 }: { r: Room; i: number; step?: number }) {
  return r.deck ? <HtmlSlide deck={r.deck} idx={i} step={step} /> : <Slide s={DECK[i]} />
}
export const notesAt = (r: Room, i: number) => (r.deck ? r.deck.slides[i]?.notes : DECK[i]?.notes) ?? ''

/** What the projector shows: slide + QR/PIN, rising reactions, poll and pinned question overlays. */
export type StagePoll = { question: string; options: string[]; counts: number[] }
export type StageQ = { text: string; slide: number; votes: number; author: string }
/** Badge position as a fraction of the free space inside the stage: (0,0) top-left, (1,1) bottom-right. */
export type Badge = { x: number; y: number }

/** PIN/QR badge the presenter can drag (or move with arrow keys) anywhere on the slide. */
function PinBadge({ pos, onMove, className, children }: { pos: Badge; onMove?: (b: Badge) => void; className: string; children: React.ReactNode }) {
  const [drag, setDrag] = useState<Badge | null>(null)
  const grab = useRef({ dx: 0, dy: 0 })
  const p = drag ?? pos
  const snap = (v: number) => (v < 0.04 ? 0 : v > 0.96 ? 1 : Math.abs(v - 0.5) < 0.03 ? 0.5 : v)
  const at = (e: React.PointerEvent<HTMLDivElement>): Badge => {
    const box = e.currentTarget.parentElement!.getBoundingClientRect(), me = e.currentTarget.getBoundingClientRect()
    const fx = (e.clientX - grab.current.dx - box.left) / Math.max(1, box.width - me.width)
    const fy = (e.clientY - grab.current.dy - box.top) / Math.max(1, box.height - me.height)
    return { x: snap(clamp(fx, 0, 1)), y: snap(clamp(fy, 0, 1)) }
  }
  const key = (e: React.KeyboardEvent) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]
    if (!d || !onMove) return
    e.preventDefault(); e.stopPropagation() // keep the deck's arrow shortcuts from also changing the slide
    onMove({ x: clamp(pos.x + d[0] * 0.05, 0, 1), y: clamp(pos.y + d[1] * 0.05, 0, 1) })
  }
  return (
    <div
      className={cx('chameleon pointer-events-auto absolute', onMove && 'cursor-grab touch-none select-none hover:ring-2 hover:ring-white/40 focus-visible:ring-2', drag ? 'cursor-grabbing' : 'transition-[left,top,translate] duration-500 ease-[cubic-bezier(0.2,0,0,1)]', className)}
      style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, translate: `${-p.x * 100}% ${-p.y * 100}%` }}
      {...(onMove && {
        tabIndex: 0, role: 'group', title: 'Arraste para mudar o PIN de lugar',
        'aria-label': 'PIN da sessão. Arraste ou use as setas para mudar de lugar.',
        onKeyDown: key,
        onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
          if (e.button !== 0) return
          const me = e.currentTarget.getBoundingClientRect()
          grab.current = { dx: e.clientX - me.left, dy: e.clientY - me.top }
          e.currentTarget.setPointerCapture(e.pointerId)
          setDrag(pos)
        },
        onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => { if (drag) setDrag(at(e)) },
        onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => { if (!drag) return; onMove(at(e)); setDrag(null) },
        onPointerCancel: () => setDrag(null),
      })}
    >
      {children}
    </div>
  )
}

/** The projected screen: slide plus PIN/QR, floating reactions, open poll and pinned question. */
export function StageView({ slide, pin, joinUrl, showQr, reacts, poll, pinned, badge = { x: 1, y: 0 }, onBadge, className }: {
  slide: React.ReactNode; pin: string; joinUrl?: string; showQr: boolean; reacts: S['reacts']
  poll?: StagePoll | null; pinned?: StageQ | null; badge?: Badge; onBadge?: (b: Badge) => void; className?: string
}) {
  const total = poll ? poll.counts.reduce((a, b) => a + b, 0) : 0
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0)
  return (
    <div className={cx('relative overflow-hidden rounded-2xl ring-1 ring-white/10', className)}>
      {slide}
      <div className="pointer-events-none absolute inset-[3%]">
        <PinBadge pos={badge} onMove={onBadge}
          className={showQr ? 'flex w-[17%] min-w-20 flex-col items-center rounded-2xl p-[1%]' : 'rounded-full px-3 py-1 font-mono text-xs font-semibold'}>
          {showQr ? (
            <>
              <QR value={joinUrl} className="pointer-events-none w-full rounded-lg" />
              <div className="mt-1 text-[clamp(8px,0.9vw,12px)] text-white/80">Entre com o PIN</div>
              <div className="font-mono text-[clamp(9px,1.1vw,15px)] font-semibold tracking-wider">{pin}</div>
            </>
          ) : <>PIN {pin}</>}
        </PinBadge>
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-full">
        {reacts.map(r => (
          <span key={r.id} className={cx('liquid animate-rise absolute bottom-[6%] grid size-[clamp(28px,3.6vw,48px)] place-items-center rounded-full bg-gradient-to-b text-[clamp(14px,1.8vw,24px)]', R_BG[r.kind])} style={{ left: r.left + '%' }}>{EMOJI[r.kind]}</span>
        ))}
      </div>
      {poll && (
        <div className="glass animate-fade-up absolute bottom-[4%] left-[3%] w-[min(46%,420px)] rounded-2xl p-[1.5%] text-[clamp(9px,1vw,14px)]">
          <div className="font-semibold text-orange-300">Enquete · {total} votos</div>
          <div className="mt-1 font-display font-semibold text-white">{poll.question}</div>
          <div className="mt-2 space-y-1.5">
            {poll.options.map((o, i) => (
              <div key={o}><div className="flex justify-between gap-2 text-emerald-50"><span className="truncate">{o}</span><span>{pct(poll.counts[i])}%</span></div><Bar pct={pct(poll.counts[i])} /></div>
            ))}
          </div>
        </div>
      )}
      {pinned && (
        <div className="glass animate-fade-up absolute inset-x-[3%] bottom-[4%] rounded-2xl border-orange-300/40 p-[1.6%] text-[clamp(10px,1.2vw,16px)]">
          <div className="flex flex-wrap items-center gap-2 text-[0.8em]"><Chip tone="orange">Pergunta no palco</Chip><span className="text-emerald-100/60">Slide {pinned.slide + 1} · {pinned.votes} votos · {pinned.author}</span></div>
          <div className="mt-1 font-display text-[1.4em] font-semibold leading-snug text-white">{pinned.text}</div>
        </div>
      )}
    </div>
  )
}

export function Stage({ r, className }: { r: Room; className?: string }) {
  const { s } = r
  return (
    <StageView className={className} slide={<SlideAt r={r} i={s.cur} step={s.step} />} pin={PIN} showQr={s.showQr} reacts={s.reacts}
      badge={s.badge} onBadge={b => r.up(() => ({ badge: b }))}
      poll={s.poll.status !== 'idle' && s.poll.onStage ? { question: POLL.q, options: POLL.options, counts: s.poll.votes } : null}
      pinned={r.pinnedQ} />
  )
}
