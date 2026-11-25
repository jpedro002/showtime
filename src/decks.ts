import type { PDFPageProxy } from 'pdfjs-dist'
import { supabase } from './supabase'

/** A slide is either HTML (imported from Claude Slides, sharing the deck CSS) or a pair of WebP images (uploaded PDF). */
export type DeckSlideRec = { title: string; html: string; stage: string | null; mobile: string | null; notes: string }
export type HtmlDeck = { id: string; title: string; css: string; fonts: string[]; duration_min: number; slides: DeckSlideRec[] }

export type SessionRow = {
  id: string; deck_id: string; owner_id: string; pin: string; status: 'live' | 'ended'
  current_slide: number; current_step: number; free_nav: boolean; moderation: boolean
  started_at: string; ended_at: string | null; peak_online: number; badge_x: number; badge_y: number
}
/** Session plus participant and question counts (and the deck title when listed across decks). */
export type SessionSummary = SessionRow & { participants: { count: number }[]; questions: { count: number }[]; decks: { title: string } | null }

export const imgUrl = (path: string) => supabase.storage.from('slides').getPublicUrl(path).data.publicUrl
export const fmtPin = (pin: string) => pin.slice(0, 3) + ' ' + pin.slice(3)

type SlideRow = { title: string; html: string | null; stage_path: string | null; mobile_path: string | null }
const toSlide = (x: SlideRow, notes = ''): DeckSlideRec => ({ title: x.title, html: x.html ?? '', stage: x.stage_path, mobile: x.mobile_path, notes })

export async function fetchDeck(id: string): Promise<HtmlDeck> {
  const [d, s, n] = await Promise.all([
    supabase.from('decks').select('id, title, css, fonts, duration_min').eq('id', id).single(),
    supabase.from('slides').select('idx, title, html, stage_path, mobile_path').eq('deck_id', id).order('idx'),
    supabase.from('speaker_notes').select('idx, body').eq('deck_id', id),
  ])
  const err = d.error ?? s.error ?? n.error
  if (err) throw err
  const notes = new Map(n.data!.map(x => [x.idx, x.body]))
  return { ...d.data!, slides: s.data!.map(x => toSlide(x, notes.get(x.idx))) }
}

/** An owner's decks, each with only its cover slide and its sessions' status. */
export async function listDecks(ownerId: string) {
  const { data, error } = await supabase.from('decks')
    .select('id, title, css, fonts, status, slide_count, duration_min, created_at, slides(title, html, stage_path, mobile_path), sessions(id, status)')
    .eq('owner_id', ownerId).eq('slides.idx', 0).order('created_at', { ascending: false })
  if (error) throw error
  return data.map(d => ({ ...d, slides: d.slides.map((x: SlideRow) => toSlide(x)) as DeckSlideRec[] }))
}
export type DeckListItem = Awaited<ReturnType<typeof listDecks>>[number]

export async function listSessions(filter: { deck_id: string } | { owner_id: string }) {
  const { data, error } = await supabase.from('sessions')
    .select('*, participants(count), questions(count), decks(title)')
    .match(filter).order('started_at', { ascending: false })
  if (error) throw error
  return data as SessionSummary[]
}

export const minutes = (s: Pick<SessionRow, 'started_at' | 'ended_at'>) =>
  Math.max(1, Math.round(((s.ended_at ? Date.parse(s.ended_at) : Date.now()) - Date.parse(s.started_at)) / 60000))

async function webp(page: PDFPageProxy, width: number) {
  const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  await page.render({ canvas, viewport }).promise
  const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/webp', 0.85))
  // shortcut: bucket accepts only WebP and Safari's canvas can't encode it; add a JPEG fallback if Safari presenters show up.
  if (blob?.type !== 'image/webp') throw new Error('Este navegador não gera imagens WebP. Envie pelo Chrome, Edge ou Firefox.')
  return blob
}

/** Converts a PDF in the browser: each page becomes a 1920px (stage) and a 1280px (phone) WebP in Storage. */
export async function uploadPdf(file: File, onPage: (done: number, total: number) => void) {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const title = file.name.replace(/\.pdf$/i, '').slice(0, 200) || 'Apresentação'
  const { data: deck, error } = await supabase.from('decks').insert({ title, slide_count: pdf.numPages }).select('id').single()
  if (error) throw error
  try {
    for (let i = 0; i < pdf.numPages; i++) {
      const page = await pdf.getPage(i + 1)
      const paths = [`${deck.id}/${i}_stage.webp`, `${deck.id}/${i}_mob.webp`] as const
      const blobs = [await webp(page, 1920), await webp(page, 1280)]
      for (const [k, path] of paths.entries()) {
        const up = await supabase.storage.from('slides').upload(path, blobs[k], { contentType: 'image/webp', upsert: true })
        if (up.error) throw up.error
      }
      const text = (await page.getTextContent()).items.map(it => ('str' in it ? it.str : '')).join(' ').replace(/\s+/g, ' ').trim()
      const ins = await supabase.from('slides').insert({ deck_id: deck.id, idx: i, title: text.slice(0, 80), text, stage_path: paths[0], mobile_path: paths[1] })
      if (ins.error) throw ins.error
      onPage(i + 1, pdf.numPages)
    }
    await supabase.from('decks').update({ status: 'ready' }).eq('id', deck.id)
  } catch (e) {
    await supabase.from('decks').update({ status: 'error' }).eq('id', deck.id)
    throw e
  }
  return deck.id as string
}

/** Deletes a deck (slides, sessions and reports cascade) and its slide images. */
export async function deleteDeck(id: string) {
  const { data } = await supabase.storage.from('slides').list(id, { limit: 1000 })
  if (data?.length) await supabase.storage.from('slides').remove(data.map(f => `${id}/${f.name}`))
  const { error } = await supabase.from('decks').delete().eq('id', id)
  if (error) throw error
}
