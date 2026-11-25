import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { Question } from '../data'
import { DECK, DECK_TITLE, PIN, POLL } from '../data'
import { EMOJI, N, Stage, useRoom } from '../room'
import { Slide } from '../Slide'
import { Bar, btn, Check, Chip, cx, LiveDot, Logo, Switch, Toast } from '../ui'


function Panel({ title, path, children, className }: { title: string; path?: string; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cx('glass flex min-w-0 flex-col rounded-[2rem] p-4 sm:p-5', className)}>
      <div className="mb-4 flex items-center justify-between gap-3 px-1">
        <h2 className="font-display text-lg font-semibold text-white">{title}</h2>
        {path && <span className="truncate font-mono text-xs text-emerald-100/45">{path}</span>}
      </div>
      {children}
    </section>
  )
}

const H3 = ({ children, aside }: { children: ReactNode; aside?: ReactNode }) => (
  <div className="mb-3 flex items-center justify-between gap-2"><h3 className="font-display text-sm font-semibold text-white">{children}</h3>{aside}</div>
)

function VoteBtn({ q, onVote }: { q: Question; onVote: () => void }) {
  return (
    <button onClick={onVote} disabled={q.status === 'pending'} aria-pressed={q.voted} aria-label={(q.voted ? 'Remover voto da' : 'Votar na') + ' pergunta'}
      className={cx('flex w-11 shrink-0 flex-col items-center rounded-xl border py-1.5 text-xs font-bold transition active:scale-95 disabled:opacity-40',
        q.voted ? 'liquid border-emerald-300/60 bg-gradient-to-b from-emerald-300 to-emerald-500 text-ink' : 'border-white/12 bg-white/5 text-white hover:bg-white/10')}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 4l8 10H4z" /></svg>{q.votes}
    </button>
  )
}

export default function Live() {
  const r = useRoom()
  const {
    s, up, toast, saving, eff, approved, pending, hidden, audQs, hot, pct, pollLabel, timeFrac, timer,
    go, audGo, vote, answer, pin, setStatus, merge, react, sendQ, onNote, pickPoll, launchPoll, closePoll, newPoll, togglePollStage,
  } = r


  const pinBtn = (q: Question, short?: boolean) => (
    <button onClick={() => pin(q.id)} className={btn(s.pinned === q.id ? 'accent' : 'ghost', 'sm')}>
      {s.pinned === q.id ? (short ? 'No telão' : 'Tirar do telão') : short ? 'Telão' : 'Exibir no telão'}
    </button>
  )

  return (
    <div className="mx-auto max-w-[1600px] px-3 pb-10 sm:px-5">
      {/* Header */}
      <header className="glass sticky top-3 z-30 mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-3xl px-4 py-3">
        <Logo small />
        <div className="hidden h-6 w-px bg-white/15 md:block" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-sm font-semibold text-white">{DECK_TITLE}</div>
          <div className="hidden truncate text-xs text-emerald-100/50 sm:block">Simulação — as quatro telas abaixo compartilham o mesmo estado da sessão</div>
        </div>
        <Chip tone="orange" className="text-xs"><LiveDot />Ao vivo · <span className="font-mono">{timer}</span></Chip>
        <Chip className="hidden font-mono sm:inline-flex">PIN {PIN}</Chip>
        <Chip tone="green">👥 {s.online} online</Chip>
        <Link to="/relatorio" className={btn('ghost', 'sm')}>Encerrar e ver relatório</Link>
      </header>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* Stage */}
        <Panel title="Telão" path="/stage/849201">
          <Stage r={r} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-emerald-100/55">
            <span className="font-semibold text-white">Slide {s.cur + 1} de {N}</span>
            <span className="min-w-0">Passador: <kbd className="font-mono">→</kbd> próximo · <kbd className="font-mono">←</kbd> anterior · <kbd className="font-mono">P</kbd> destaca a pergunta mais votada · <kbd className="font-mono">Q</kbd> mostra/oculta o QR</span>
          </div>
        </Panel>

        {/* Audience phone */}
        <Panel title="Público" path="/watch/849201" className="xl:row-span-2">
          <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col rounded-[2.6rem] border border-white/15 bg-black/30 p-3 shadow-[inset_0_0_0_6px_rgb(0_0_0/0.35)]">
            <div className="flex items-center justify-between px-3 pb-2 pt-1 text-xs">
              <span className="flex items-center gap-1.5 font-bold text-orange-300"><LiveDot />AO VIVO</span>
              <span className="text-emerald-100/60">PIN {PIN} · {s.online} online</span>
            </div>
            <div className="overflow-hidden rounded-2xl ring-1 ring-white/10"><Slide s={DECK[eff]} /></div>
            <div className="mt-2 flex items-center gap-2">
              <button onClick={() => audGo(eff - 1)} disabled={eff === 0} aria-label="Slide anterior" className={btn('ghost', 'sm', 'size-9 px-0')}>‹</button>
              <div className="flex-1 text-center">
                <div className="text-xs font-semibold text-white">Slide {eff + 1} de {N}</div>
                <div className={cx('text-[11px]', eff === s.cur ? 'text-emerald-300' : 'text-orange-300')}>{eff === s.cur ? 'Ao vivo' : `Revendo · o palestrante está no ${s.cur + 1}`}</div>
              </div>
              <button onClick={() => audGo(eff + 1)} disabled={eff >= s.cur} aria-label="Próximo slide" className={btn('ghost', 'sm', 'size-9 px-0')}>›</button>
            </div>
            {eff !== s.cur && <button onClick={() => up(() => ({ follow: true }))} className={btn('accent', 'sm', 'mt-2 w-full')}>Voltar ao vivo — Slide {s.cur + 1}</button>}

            <div role="tablist" aria-label="Seções" className="glass-soft mt-3 grid grid-cols-3 rounded-full p-1">
              {([['notas', 'Notas'], ['qa', `Perguntas · ${audQs.length}`], ['poll', 'Enquete']] as const).map(([k, l]) => (
                <button key={k} role="tab" aria-selected={s.tab === k} onClick={() => up(() => ({ tab: k }))}
                  className={cx('relative rounded-full py-1.5 text-xs font-semibold transition', s.tab === k ? 'liquid bg-gradient-to-b from-emerald-300 to-emerald-500 text-ink' : 'text-emerald-100/70 hover:text-white')}>
                  {l}{k === 'poll' && s.poll.status === 'open' && <span className="absolute right-2 top-1.5 size-1.5 rounded-full bg-orange-400" />}
                </button>
              ))}
            </div>

            <div className="mt-3 min-h-72 flex-1">
              {s.tab === 'notas' && (
                <div className="flex h-full flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="nota" className="font-semibold text-white">Sua nota no slide {eff + 1}</label>
                    <span className={saving ? 'text-orange-300' : 'text-emerald-300'}>{saving ? 'Salvando…' : '✓ Salvo'}</span>
                  </div>
                  <textarea id="nota" value={s.notes[eff] ?? ''} onChange={e => onNote(e.target.value)} placeholder="Digite aqui — a nota fica presa a este slide"
                    className="min-h-28 flex-1 resize-none rounded-2xl border border-white/12 bg-white/5 p-3 text-sm text-white placeholder:text-emerald-100/35 focus:border-emerald-300/50 focus:outline-none" />
                  {Object.keys(s.notes).some(k => s.notes[+k]?.trim()) && (
                    <div>
                      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-100/50">Slides com nota</div>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.keys(s.notes).map(Number).filter(i => s.notes[i]?.trim()).sort((a, b) => a - b).map(i => (
                          <button key={i} onClick={() => audGo(i)} className={cx('rounded-full border px-2.5 py-1 text-xs transition', i === eff ? 'border-emerald-300/70 bg-emerald-400/15 text-emerald-100' : 'border-white/12 text-emerald-100/70 hover:bg-white/5')}>Slide {i + 1}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  <Link to="/apostila" className={btn('ghost', 'sm', 'mt-1')}>📄 Gerar apostila com minhas notas</Link>
                  <p className="text-[11px] text-emerald-100/45">Você entrou sem cadastro. Suas notas ficam salvas neste aparelho, mesmo se o Wi-Fi cair.</p>
                </div>
              )}

              {s.tab === 'qa' && (
                <div>
                  <label htmlFor="pergunta" className="text-xs text-emerald-100/65">Será anexada ao <strong className="text-white">Slide {eff + 1}</strong></label>
                  <textarea id="pergunta" value={s.draft} onChange={e => up(() => ({ draft: e.target.value.slice(0, 280) }))} placeholder="Escreva sua pergunta" rows={3}
                    className="mt-1.5 w-full resize-none rounded-2xl border border-white/12 bg-white/5 p-3 text-sm text-white placeholder:text-emerald-100/35 focus:border-emerald-300/50 focus:outline-none" />
                  <div className="mt-1.5 flex items-center gap-3">
                    <Check on={s.anon} onChange={v => up(() => ({ anon: v }))} className="text-xs text-emerald-50">Anônimo</Check>
                    <span className={cx('ml-auto text-xs', s.draft.length > 250 ? 'text-orange-300' : 'text-emerald-100/50')}>{s.draft.length}/280</span>
                    <button onClick={sendQ} disabled={!s.draft.trim() || s.cooldown > 0} className={btn('primary', 'sm')}>{s.cooldown > 0 ? `Aguarde ${s.cooldown}s` : 'Enviar'}</button>
                  </div>
                  <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                    {audQs.map(q => (
                      <li key={q.id} className={cx('glass-soft flex gap-2.5 rounded-2xl p-2.5', q.answered && 'opacity-55', s.pinned === q.id && 'border-orange-300/40 bg-orange-400/8')}>
                        <VoteBtn q={q} onVote={() => vote(q.id)} />
                        <div className="min-w-0">
                          <div className="text-sm text-white">{q.text}</div>
                          <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-emerald-100/50">
                            <span>Slide {q.slide + 1}</span><span>· {q.author}</span>
                            {q.status === 'pending' && <Chip tone="gray">Aguardando moderação</Chip>}
                            {q.answered && <Chip tone="green">Respondida</Chip>}
                            {s.pinned === q.id && <Chip tone="orange">No telão agora</Chip>}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {s.tab === 'poll' && (
                s.poll.status === 'idle' ? (
                  <p className="glass-soft rounded-2xl p-4 text-center text-sm text-emerald-100/65">Nenhuma enquete aberta agora. Quando o palestrante lançar uma, ela aparece aqui.</p>
                ) : (
                  <div>
                    <div className="font-display font-semibold text-white">{POLL.q}</div>
                    {s.poll.status === 'open' && s.poll.myVote === null ? (
                      <div className="mt-3 space-y-2">
                        {POLL.options.map((o, i) => <button key={o} onClick={() => pickPoll(i)} className="glass-soft w-full rounded-2xl px-4 py-3 text-left text-sm text-white transition hover:border-emerald-300/50 hover:bg-white/10">{o}</button>)}
                      </div>
                    ) : (
                      <>
                        <div className="mt-1 text-xs text-emerald-100/55">{pollLabel}</div>
                        <div className="mt-3 space-y-3">
                          {POLL.options.map((o, i) => (
                            <div key={o}>
                              <div className={cx('mb-1 flex justify-between gap-2 text-sm', s.poll.myVote === i ? 'font-bold text-orange-200' : 'text-emerald-50')}><span>{o}{s.poll.myVote === i && ' · seu voto'}</span><span>{pct(s.poll.votes[i])}%</span></div>
                              <Bar pct={pct(s.poll.votes[i])} mine={s.poll.myVote === i} />
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )
              )}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
              {(['fogo', 'palmas', 'uau'] as const).map(k => (
                <button key={k} onClick={() => react(k)} aria-label={`Reagir com ${k === 'palmas' ? 'aplauso' : k}`}
                  className="glass-soft flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-lg transition hover:bg-white/10 active:scale-90">
                  {EMOJI[k]}<span className="text-xs font-semibold text-emerald-100/70">{s.totals[k]}</span>
                </button>
              ))}
            </div>
          </div>
          <Toast msg={toast} />
        </Panel>

        {/* Presenter console */}
        <Panel title="Palestrante" path="/presenter/sess_abc123">
          <div className="grid grid-cols-3 gap-3">
            <div className="glass-soft rounded-2xl p-3">
              <div className="flex items-baseline gap-2"><span className="font-mono text-2xl font-medium text-white">{timer}</span><span className="text-xs text-emerald-100/50">de 45:00</span></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className={cx('h-full rounded-full transition-all', timeFrac > 0.85 ? 'bg-orange-400' : 'bg-emerald-400')} style={{ width: timeFrac * 100 + '%' }} /></div>
            </div>
            <div className="glass-soft rounded-2xl p-3"><div className="text-xs text-emerald-100/55">Público</div><div className="font-display text-2xl font-bold text-white">{s.online}</div></div>
            <div className="glass-soft rounded-2xl p-3"><div className="text-xs text-emerald-100/55">Perguntas</div><div className="font-display text-2xl font-bold text-orange-300">{approved.length}</div></div>
            <div className="col-span-3 flex items-center gap-2">
              <button onClick={() => go(s.cur - 1)} disabled={s.cur === 0} className={btn('ghost', 'lg', 'flex-1')}>‹ Anterior</button>
              <button onClick={() => go(s.cur + 1)} disabled={s.cur === N - 1} className={btn('primary', 'lg', 'flex-1')}>Próximo ›</button>
            </div>
          </div>

          {hot && (
            <div className="animate-fade-up mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-orange-300/35 bg-orange-400/10 p-3">
              <div className="min-w-0 flex-1 basis-56">
                <div className="text-xs font-semibold text-orange-300">🔥 Pergunta em alta · {hot.votes} votos · Slide {hot.slide + 1}</div>
                <div className="mt-0.5 text-sm text-white">{hot.text}</div>
              </div>
              <button onClick={() => go(hot.slide)} className={btn('ghost', 'sm')}>Ir ao Slide {hot.slide + 1}</button>
              <button onClick={() => pin(hot.id)} className={btn('accent', 'sm')}>Exibir no telão</button>
            </div>
          )}

          <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-300">Agora · Slide {s.cur + 1}</div>
              <div className="overflow-hidden rounded-2xl ring-2 ring-emerald-400/50"><Slide s={DECK[s.cur]} /></div>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-100/50">A seguir</div>
                {s.cur < N - 1
                  ? <div className="overflow-hidden rounded-2xl opacity-80 ring-1 ring-white/10"><Slide s={DECK[s.cur + 1]} /></div>
                  : <div className="glass-soft grid aspect-video place-items-center rounded-2xl text-sm text-emerald-100/55">Fim da apresentação</div>}
              </div>
              <div className="glass-soft flex-1 rounded-2xl p-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-orange-300">Notas do orador</div>
                <p className="mt-1 text-sm leading-relaxed text-emerald-50">{DECK[s.cur].notes}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
            {DECK.map((d, i) => (
              <button key={i} onClick={() => go(i)} aria-label={`Ir para o slide ${i + 1}`} aria-current={i === s.cur}
                className={cx('w-28 shrink-0 overflow-hidden rounded-xl border-2 transition', i === s.cur ? 'border-orange-400' : 'border-transparent opacity-60 hover:opacity-100')}>
                <Slide s={d} />
                <div className={cx('py-0.5 text-[11px] font-semibold', i === s.cur ? 'bg-orange-400 text-ink' : 'bg-white/8 text-emerald-100/70')}>{i + 1}</div>
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="glass-soft rounded-2xl p-3">
              <H3 aside={<span className="text-xs text-emerald-100/45">ordenada por votos</span>}>Fila de perguntas</H3>
              <ul className="space-y-2">
                {approved.slice(0, 6).map(q => (
                  <li key={q.id} className={cx('flex flex-wrap items-center gap-3 rounded-xl border p-2.5 transition', s.pinned === q.id ? 'border-orange-300/40 bg-orange-400/10' : 'border-white/8 bg-white/[0.03]', q.answered && 'opacity-55')}>
                    <span className="w-8 text-center font-display text-lg font-bold text-white">{q.votes}</span>
                    <div className="min-w-0 flex-1 basis-48">
                      <div className="text-sm text-white">{q.text}</div>
                      <div className="text-[11px] text-emerald-100/50">Slide {q.slide + 1} · {q.author}</div>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => go(q.slide)} className={btn('quiet', 'sm')}>Slide {q.slide + 1}</button>
                      <button onClick={() => answer(q.id)} className={btn('ghost', 'sm')}>{q.answered ? 'Reabrir' : 'Respondida'}</button>
                      {pinBtn(q, true)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="glass-soft rounded-2xl p-3">
              <H3 aside={<Chip tone={s.poll.status === 'open' ? 'orange' : 'gray'}>{pollLabel}</Chip>}>Enquete</H3>
              <div className="text-sm text-white">{POLL.q}</div>
              {s.poll.status !== 'idle' && (
                <div className="mt-3 space-y-2">
                  {POLL.options.map((o, i) => (
                    <div key={o}><div className="mb-1 flex justify-between gap-2 text-xs text-emerald-50"><span className="truncate">{o}</span><span className="font-semibold">{s.poll.votes[i]}</span></div><Bar pct={pct(s.poll.votes[i])} /></div>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {s.poll.status === 'idle' && <button onClick={launchPoll} className={btn('accent', 'sm')}>Lançar enquete</button>}
                {s.poll.status === 'open' && <button onClick={closePoll} className={btn('ghost', 'sm')}>Encerrar votação</button>}
                {s.poll.status === 'closed' && <button onClick={newPoll} className={btn('ghost', 'sm')}>Nova enquete</button>}
                {s.poll.status !== 'idle' && <button onClick={togglePollStage} className={btn('quiet', 'sm')}>{s.poll.onStage ? 'Ocultar do telão' : 'Mostrar no telão'}</button>}
              </div>
            </div>
          </div>
        </Panel>

        {/* Moderator */}
        <Panel title="Moderador" path="opcional, para eventos grandes" className="xl:col-span-2">
          <div className="glass-soft mb-4 rounded-2xl p-3 sm:max-w-md">
            <Switch on={s.moderation} onChange={() => up(p => ({ moderation: !p.moderation }))} label="Moderar antes de publicar" />
          </div>
          <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
            <div>
              <H3>Aguardando · {pending.length}</H3>
              {!pending.length && <p className="glass-soft rounded-2xl p-4 text-sm text-emerald-100/55">Nada na fila.</p>}
              <ul className="space-y-2">
                {pending.map(q => {
                  const dup = q.dupOf && s.questions.find(x => x.id === q.dupOf)
                  return (
                    <li key={q.id} className="glass-soft rounded-2xl p-3">
                      <div className="text-sm text-white">{q.text}</div>
                      <div className="mt-0.5 text-[11px] text-emerald-100/50">Slide {q.slide + 1} · {q.author} · {q.votes} {q.votes === 1 ? 'voto' : 'votos'}</div>
                      {dup && <div className="mt-2 rounded-lg bg-orange-400/10 px-2 py-1 text-xs text-orange-200">Parecida com: “{dup.text}”</div>}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <button onClick={() => setStatus(q.id, 'approved')} className={btn('primary', 'sm')}>✓ Aprovar</button>
                        {dup && <button onClick={() => merge(q.id)} className={btn('accent', 'sm')}>Mesclar</button>}
                        <button onClick={() => setStatus(q.id, 'hidden')} className={btn('danger', 'sm')}>Ocultar</button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
            <div className={hidden.length ? '' : 'lg:col-span-2'}>
              <H3>Publicadas · {approved.length}</H3>
              <ul className="space-y-2">
                {approved.map(q => (
                  <li key={q.id} className={cx('glass-soft flex flex-wrap items-center gap-2 rounded-2xl p-3', s.pinned === q.id && 'border-orange-300/40 bg-orange-400/8', q.answered && 'opacity-55')}>
                    <span className="w-8 font-display font-bold text-white">{q.votes}</span>
                    <div className="min-w-0 flex-1 basis-40 text-sm text-white">{q.text}</div>
                    <div className="flex gap-1.5">
                      {pinBtn(q)}
                      <button onClick={() => answer(q.id)} className={btn('ghost', 'sm')}>{q.answered ? 'Reabrir' : 'Respondida'}</button>
                      <button onClick={() => setStatus(q.id, 'hidden')} className={btn('danger', 'sm')}>Ocultar</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            {hidden.length > 0 && (
              <div>
                <H3>Ocultas · {hidden.length}</H3>
                <ul className="space-y-2">
                  {hidden.map(q => (
                    <li key={q.id} className="glass-soft flex items-center gap-2 rounded-2xl p-3">
                      <div className="min-w-0 flex-1 text-sm text-emerald-100/50 line-through">{q.text}</div>
                      <button onClick={() => setStatus(q.id, 'approved')} className={btn('ghost', 'sm')}>Restaurar</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  )
}
