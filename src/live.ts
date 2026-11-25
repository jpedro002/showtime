import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchDeck, type HtmlDeck, type SessionRow } from './decks'
import { countSteps } from './HtmlSlide'
import type { Kind } from './room'
import { supabase } from './supabase'

export type QRow = {
  id: number; session_id: string; author_id: string; nickname: string | null; text: string; slide: number
  status: 'pending' | 'approved' | 'hidden' | 'merged'; dup_of: number | null; answered: boolean; pinned: boolean
  upvote_count: number; created_at: string
}
export type PollRow = { id: number; session_id: string; question: string; options: string[]; counts: number[]; status: 'idle' | 'open' | 'closed'; on_stage: boolean; slide: number | null }
export type Float = { id: number; kind: Kind; left: number; born: number }
type Change = { table: string; operation: 'INSERT' | 'UPDATE' | 'DELETE'; record: never; old_record: { id: number } }

const ZERO: Record<Kind, number> = { fogo: 0, palmas: 0, uau: 0 }
const upsert = <T extends { id: number }>(list: T[], row: T) =>
  list.some(x => x.id === row.id) ? list.map(x => (x.id === row.id ? row : x)) : [...list, row]
const msg = (e: unknown) => (e as { message?: string })?.message ?? String(e)

/** Unanswered first, then most voted. */
export const byRank = (a: QRow, b: QRow) => Number(a.answered) - Number(b.answered) || b.upvote_count - a.upvote_count
export const author = (q: QRow) => q.nickname ?? 'Anônimo'

/**
 * One live session over Supabase Realtime. `host` = the deck owner (console or stage): sees every question,
 * counts who is online and receives reactions. `audience` = a participant: is counted, sends reactions.
 * Slide changes, questions and polls arrive from DB triggers on the private channel `session:{id}`.
 */
export function useLive(sessionId: string, role: 'host' | 'audience') {
  const [me, setMe] = useState<string | null>(null)
  const [session, setSession] = useState<SessionRow | null>(null)
  const [deck, setDeck] = useState<HtmlDeck | null>(null)
  const [questions, setQuestions] = useState<QRow[]>([])
  const [polls, setPolls] = useState<PollRow[]>([])
  const [online, setOnline] = useState(0)
  const [floats, setFloats] = useState<Float[]>([])
  const [totals, setTotals] = useState(ZERO)
  const [myVotes, setMyVotes] = useState<Set<number>>(new Set())
  const [myPoll, setMyPoll] = useState<Record<number, number>>({})
  const [nickname, setNickname] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showQr, setShowQr] = useState(true)
  const mainCh = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const peak = useRef(0)
  const fid = useRef(0)
  const hostCh = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const pending = useRef<Partial<Record<Kind, number>>>({})
  const slideRef = useRef(0)
  useEffect(() => { slideRef.current = session?.current_slide ?? 0 })

  const float = useCallback((kind: Kind) => {
    const id = ++fid.current
    setFloats(f => [...f.slice(-30), { id, kind, left: 6 + Math.random() * 86, born: Date.now() }])
    setTotals(t => ({ ...t, [kind]: t[kind] + 1 }))
  }, [])

  useEffect(() => {
    let alive = true
    const chans: ReturnType<typeof supabase.channel>[] = []
    const onChange = ({ payload: p }: { payload: Change }) => {
      if (p.table === 'sessions') { if (p.record) setSession(p.record); else setError('Esta sessão foi removida.'); return }
      if (p.table === 'questions') setQuestions(l => (p.operation === 'DELETE' ? l.filter(q => q.id !== p.old_record.id) : upsert(l, p.record)))
      if (p.table === 'polls') setPolls(l => (p.operation === 'DELETE' ? l.filter(q => q.id !== p.old_record.id) : upsert(l, p.record)))
    }

    const load = async (uid: string) => {
      const s = await supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle()
      if (s.error) throw s.error
      if (!s.data) throw new Error('Sessão não encontrada ou você não entrou nela.')
      const [d, q, p] = await Promise.all([
        fetchDeck(s.data.deck_id),
        supabase.from('questions').select('*').eq('session_id', sessionId),
        supabase.from('polls').select('*').eq('session_id', sessionId).order('id'),
      ])
      if (q.error || p.error) throw q.error ?? p.error
      if (!alive) return
      setSession(s.data); setDeck(d); setQuestions(q.data); setPolls(p.data)
      peak.current = s.data.peak_online
      if (role === 'host') {
        const rc = await supabase.from('reaction_counts').select('kind, count').eq('session_id', sessionId)
        const t = { ...ZERO }
        for (const r of rc.data ?? []) t[r.kind as Kind] += r.count
        if (alive) setTotals(t)
      } else {
        const [v, pv, me] = await Promise.all([
          supabase.from('question_votes').select('question_id').eq('user_id', uid),
          supabase.from('poll_votes').select('poll_id, option').eq('user_id', uid),
          supabase.from('participants').select('nickname').eq('session_id', sessionId).eq('user_id', uid).maybeSingle(),
        ])
        if (!alive) return
        setMyVotes(new Set(v.data?.map(x => x.question_id)))
        setMyPoll(Object.fromEntries(pv.data?.map(x => [x.poll_id, x.option]) ?? []))
        setNickname(me.data?.nickname ?? null)
      }
    }

    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id
      if (!uid) return setError('Entre com o PIN para participar.')
      if (!alive) return
      setMe(uid)
      await supabase.realtime.setAuth()
      const main = supabase.channel(`session:${sessionId}`, { config: { private: true, presence: { key: uid, enabled: role === 'host' } } })
        .on('broadcast', { event: '*' }, onChange)
        .on('broadcast', { event: 'qr' }, ({ payload }) => setShowQr(!!payload.show))
      mainCh.current = main
      if (role === 'host') {
        main.on('presence', { event: 'sync' }, () => {
          const n = Object.keys(main.presenceState()).length
          peak.current = Math.max(peak.current, n)
          setOnline(n)
        })
        const host = supabase.channel(`session:${sessionId}:host`, { config: { private: true } })
          .on('broadcast', { event: 'react' }, ({ payload }) => float(payload.kind))
          .on('broadcast', { event: '*' }, onChange)
          .subscribe()
        chans.push(host)
      } else {
        hostCh.current = supabase.channel(`session:${sessionId}:host`, { config: { private: true } })
      }
      chans.push(main)
      main.subscribe(status => {
        if (status !== 'SUBSCRIBED') return
        if (role === 'audience') main.track({ at: Date.now() })
        load(uid).catch(e => alive && setError(msg(e)))
      })
    })
    return () => {
      alive = false
      chans.forEach(c => supabase.removeChannel(c))
      if (hostCh.current) supabase.removeChannel(hostCh.current)
    }
  }, [sessionId, role, float])

  // floating reactions fade after their 2.9s rise
  useEffect(() => {
    if (!floats.length) return
    const t = setTimeout(() => setFloats(f => f.filter(x => Date.now() - x.born < 2900)), 1000)
    return () => clearTimeout(t)
  }, [floats])

  // audience: reactions are batched into the report every 3s
  useEffect(() => {
    if (role !== 'audience') return
    const t = setInterval(() => {
      for (const [kind, n] of Object.entries(pending.current)) {
        if (n) supabase.rpc('add_reactions', { p_session_id: sessionId, p_slide: slideRef.current, p_kind: kind, p_n: n }).then()
      }
      pending.current = {}
    }, 3000)
    return () => clearInterval(t)
  }, [role, sessionId])

  const run = useCallback(async (p: PromiseLike<{ error: unknown }>) => {
    const { error } = await p
    if (error) setError(msg(error))
    return !error
  }, [])

  // ── host actions ──
  const go = (slide: number, step = 0) => {
    if (!session || !deck) return
    const s = Math.max(0, Math.min(deck.slides.length - 1, slide))
    setSession({ ...session, current_slide: s, current_step: step })
    run(supabase.from('sessions').update({ current_slide: s, current_step: step }).eq('id', sessionId))
  }
  const patchSession = (patch: Partial<SessionRow>) => {
    setSession(s => s && { ...s, ...patch })
    return run(supabase.from('sessions').update(patch).eq('id', sessionId))
  }
  const patchQ = (id: number, patch: Partial<QRow>) => {
    setQuestions(l => l.map(q => (q.id === id ? { ...q, ...patch } : q)))
    return run(supabase.from('questions').update(patch).eq('id', id))
  }
  const pin = async (id: number) => {
    const on = !questions.find(q => q.id === id)?.pinned
    setQuestions(l => l.map(q => ({ ...q, pinned: q.id === id ? on : false })))
    if (on) await supabase.from('questions').update({ pinned: false }).eq('session_id', sessionId).eq('pinned', true)
    run(supabase.from('questions').update({ pinned: on }).eq('id', id))
  }
  const launchPoll = (question: string, options: string[]) =>
    run(supabase.from('polls').insert({ session_id: sessionId, question, options, status: 'open', on_stage: true, slide: session?.current_slide ?? 0 }))
  const patchPoll = (id: number, patch: Partial<PollRow>) => {
    setPolls(l => l.map(p => (p.id === id ? { ...p, ...patch } : p)))
    return run(supabase.from('polls').update(patch).eq('id', id))
  }
  const toggleQr = () => {
    setShowQr(!showQr)
    mainCh.current?.send({ type: 'broadcast', event: 'qr', payload: { show: !showQr } })
  }
  const steps = useMemo(() => deck?.slides.map(x => countSteps(x.html)) ?? [], [deck])
  const cur = session?.current_slide ?? 0, step = session?.current_step ?? 0
  const next = () => (step < (steps[cur] ?? 0) ? go(cur, step + 1) : go(cur + 1))
  const back = () => (step > 0 ? go(cur, step - 1) : cur > 0 && go(cur - 1, steps[cur - 1] ?? 0))
  const end = () => patchSession({ status: 'ended', ended_at: new Date().toISOString(), peak_online: peak.current })

  // ── audience actions ──
  const react = (kind: Kind) => {
    hostCh.current?.httpSend('react', { kind })
    pending.current[kind] = (pending.current[kind] ?? 0) + 1
  }
  const ask = async (text: string, anon: boolean) => {
    const { data, error } = await supabase.from('questions')
      .insert({ session_id: sessionId, text, slide: session?.current_slide ?? 0, nickname: anon ? null : nickname }).select().single()
    if (error) return error.message === 'cooldown' ? 'Aguarde 20 segundos entre perguntas.' : msg(error)
    setQuestions(l => upsert(l, data))
    return null
  }
  const vote = (id: number) => {
    const on = !myVotes.has(id)
    setMyVotes(v => { const n = new Set(v); if (on) n.add(id); else n.delete(id); return n })
    setQuestions(l => l.map(q => (q.id === id ? { ...q, upvote_count: q.upvote_count + (on ? 1 : -1) } : q)))
    run(on ? supabase.from('question_votes').insert({ question_id: id, user_id: me }) : supabase.from('question_votes').delete().eq('question_id', id).eq('user_id', me!))
  }
  const votePoll = (pollId: number, option: number) => {
    setMyPoll(m => ({ ...m, [pollId]: option }))
    run(supabase.from('poll_votes').insert({ poll_id: pollId, user_id: me, option }))
  }

  const poll = polls.at(-1) ?? null
  return {
    me, session, deck, questions, polls, poll, online, floats, totals, myVotes, myPoll, nickname, error, setError,
    showQr, toggleQr, steps, next, back,
    go, patchSession, patchQ, pin, launchPoll, patchPoll, end, react, ask, vote, votePoll,
  }
}
export type Live = ReturnType<typeof useLive>

/** Re-renders every second while mounted; returns Date.now(). */
export function useNow() {
  const [now, setNow] = useState(Date.now)
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  return now
}

export const joinUrl = (pin: string) => `${location.origin}/join?pin=${pin}`
export const clock = (sec: number) => `${String(Math.floor(Math.max(0, sec) / 60)).padStart(2, '0')}:${String(Math.floor(Math.max(0, sec) % 60)).padStart(2, '0')}`

/** Presenter keys (console and stage): →/PageDown/Space next, ←/PageUp back, Q QR code, P top question on stage. */
export function useDeckKeys(live: Live) {
  const ref = useRef(live)
  useEffect(() => { ref.current = live })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable=true]') || e.metaKey || e.ctrlKey || e.altKey) return
      const l = ref.current
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); l.next() }
      else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); l.back() }
      else if (e.key.toLowerCase() === 'q') l.toggleQr()
      else if (e.key.toLowerCase() === 'p') {
        const top = l.questions.filter(q => q.status === 'approved' && !q.answered).sort(byRank)[0]
        if (top) l.pin(top.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

/** What the projected screen shows from live state: the open poll (if on stage) and the pinned question. */
export const stageExtras = (l: Live) => {
  const p = l.poll && l.poll.status !== 'idle' && l.poll.on_stage ? l.poll : null
  const q = l.questions.find(x => x.pinned && x.status === 'approved')
  return {
    poll: p && { question: p.question, options: p.options, counts: p.counts },
    pinned: q && { text: q.text, slide: q.slide, votes: q.upvote_count, author: author(q) },
  }
}
