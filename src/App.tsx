import { BrowserRouter, Route, Routes } from 'react-router'
import Apostila from './pages/Apostila'
import HomeV2 from './pages/HomeV2'
import HomeV1 from './pages/HomeV1'
import Join from './pages/Join'
import Live from './pages/Live'
import Relatorio from './pages/Relatorio'
import Upload from './pages/Upload'
import { Backdrop } from './ui'

export default function App() {
  return (
    <BrowserRouter>
      <Backdrop />
      <Routes>
        <Route index element={<HomeV1 />} />
        <Route path="v2" element={<HomeV2 />} />
        <Route path="join" element={<Join />} />
        <Route path="live" element={<Live />} />
        <Route path="upload" element={<Upload />} />
        <Route path="apostila" element={<Apostila />} />
        <Route path="relatorio" element={<Relatorio />} />
        <Route path="*" element={<HomeV1 />} />
      </Routes>
    </BrowserRouter>
  )
}
