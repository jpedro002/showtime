import { useParams } from 'react-router'
import { Link } from 'react-router'
import { fmtPin } from '../decks'
import { DeckSlide } from '../HtmlSlide'
import { joinUrl, stageExtras, useDeckKeys, useLive } from '../live'
import { StageView } from '../room'
import { Icon } from '../Studio'
import { btn } from '../ui'

/** `/stage/:sessionId`: the projector view. Same keys as the console; QR toggles sync both ways. */
export default function Stage() {
  const { sessionId = '' } = useParams()
  const l = useLive(sessionId, 'host')
  useDeckKeys(l)
  const { session: s, deck } = l

  const full = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {})

  return (
    <main className="group relative grid h-dvh place-items-center overflow-hidden bg-black">
      {s && deck ? (
        <>
          <div className="w-full max-w-[calc(100dvh*16/9)]">
            <StageView slide={<DeckSlide deck={deck} idx={s.current_slide} step={s.current_step} />}
              pin={fmtPin(s.pin)} joinUrl={joinUrl(s.pin)} showQr={l.showQr} reacts={l.floats} {...stageExtras(l)}
              badge={{ x: s.badge_x, y: s.badge_y }} onBadge={b => l.patchSession({ badge_x: b.x, badge_y: b.y })} />
          </div>
          {s.status === 'ended' && (
            <div className="absolute inset-0 grid place-items-center bg-black/80 text-center">
              <div>
                <p className="font-display text-5xl font-bold text-white">Obrigado!</p>
                <p className="mt-3 text-lg text-emerald-100/70">Sessão encerrada.</p>
              </div>
            </div>
          )}
          <div className="absolute right-4 top-4 flex gap-2 opacity-0 transition duration-200 focus-within:opacity-100 group-hover:opacity-100">
            <Link to={`/presenter/${sessionId}`} className={btn('ghost', 'sm')}><Icon name="live" className="size-4" />Console</Link>
            <button onClick={full} className={btn('ghost', 'sm')}><Icon name="screen" className="size-4" />Tela cheia</button>
          </div>
        </>
      ) : (
        <p className="text-emerald-100/60">{l.error ?? 'Conectando ao telão…'}</p>
      )}
    </main>
  )
}
