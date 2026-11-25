import { BrowserRouter, Route, Routes } from 'react-router'
import { RequireAuth } from './Auth'
import Apostila from './pages/Apostila'
import Deck from './pages/Deck'
import Home from './pages/Home'
import Join from './pages/Join'
import Live from './pages/Live'
import Presenter from './pages/Presenter'
import Relatorio from './pages/Relatorio'
import Stage from './pages/Stage'
import Upload from './pages/Upload'
import Watch from './pages/Watch'
import { Backdrop } from './ui'

export default function App() {
  return (
    <BrowserRouter>
      <Backdrop />
      <Routes>
        <Route index element={<Home />} />
        <Route path="join" element={<Join />} />
        <Route path="live" element={<Live />} />
        <Route path="watch/:sessionId" element={<Watch />} />
        <Route path="presenter/:sessionId?" element={<RequireAuth><Presenter /></RequireAuth>} />
        <Route path="stage/:sessionId" element={<RequireAuth><Stage /></RequireAuth>} />
        <Route path="upload" element={<RequireAuth><Upload /></RequireAuth>} />
        <Route path="deck/:id" element={<RequireAuth><Deck /></RequireAuth>} />
        <Route path="apostila/:sessionId?" element={<Apostila />} />
        <Route path="relatorio/:sessionId?" element={<RequireAuth><Relatorio /></RequireAuth>} />
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  )
}
