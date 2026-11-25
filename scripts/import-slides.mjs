// Imports a Claude Slides deck folder (deck.json, deck.css, slides/<id>.html) as an HTML deck owned by <owner-email-or-user-id>.
// usage: node --env-file=.env.local scripts/import-slides.mjs <project-dir> <owner-email-or-user-id>
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const [dir, who] = process.argv.slice(2)
if (!dir || !who) throw new Error('usage: import-slides.mjs <project-dir> <owner-email-or-user-id>')
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })

const deck = JSON.parse(readFileSync(join(dir, 'deck.json'), 'utf8'))
const css = readFileSync(join(dir, 'deck.css'), 'utf8')
const fonts = Object.values(deck.faces ?? {}).map(f => f.href).filter(h => h?.startsWith('https://fonts.googleapis.com/css2?'))

const text = s => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const slides = deck.order.map((id, idx) => {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new Error(`bad slide id ${id}`) // ids name files
  const raw = readFileSync(join(dir, 'slides', id + '.html'), 'utf8')
  if (raw.includes('/_blob/') || raw.includes('project/ds/')) throw new Error(`${id}: image/font files are not imported yet`)
  const html = raw.replace(/<aside>[\s\S]*?<\/aside>/, '') // notes go to speaker_notes, which the audience can't read
  return {
    idx, html,
    title: text(html.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/)?.[1] ?? ''),
    text: text(html.replace(/<svg[\s\S]*?<\/svg>/g, '')),
    notes: text(raw.match(/<aside>([\s\S]*?)<\/aside>/)?.[1] ?? ''),
  }
})

const { data: { users }, error: ue } = await sb.auth.admin.listUsers({ perPage: 1000 })
if (ue) throw ue
const owner = users.find(u => u.email === who || u.id === who)
if (!owner) throw new Error(`no user ${who}`)

const { data: d, error } = await sb.from('decks')
  .insert({ owner_id: owner.id, title: deck.title, status: 'ready', slide_count: slides.length, css, fonts })
  .select('id').single()
if (error) throw error
try {
  const r1 = await sb.from('slides').insert(slides.map(({ notes: _, ...s }) => ({ deck_id: d.id, ...s })))
  if (r1.error) throw r1.error
  const r2 = await sb.from('speaker_notes').insert(slides.map(s => ({ deck_id: d.id, idx: s.idx, body: s.notes })))
  if (r2.error) throw r2.error
} catch (e) {
  await sb.from('decks').delete().eq('id', d.id) // no half-imported deck
  throw e
}
console.log(`imported "${deck.title}" (${slides.length} slides) as deck ${d.id}`)
