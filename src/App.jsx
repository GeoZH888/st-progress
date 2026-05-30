import { lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Header from './components/Header'
import Mascot from './components/Mascot'
import { Loading } from './components/Status'
import Home from './pages/Home'
import Timeline from './pages/Timeline'
import FieldsIndex from './pages/FieldsIndex'
import FieldPage from './pages/FieldPage'
import MilestonePage from './pages/MilestonePage'

// Map view is code-split: it pulls in Leaflet, which we don't want in the
// initial bundle for users who only browse the Timeline / By Field views.
const MapPage = lazy(() => import('./pages/MapPage'))

// Maps the current path to a mascot tip key (trilingual, pulled from i18n).
function tipKeyForPath(pathname) {
  if (pathname.startsWith('/timeline')) return 'timeline'
  if (pathname.startsWith('/fields') || pathname.startsWith('/field')) return 'fields'
  if (pathname.startsWith('/milestone')) return 'milestone'
  if (pathname.startsWith('/map')) return 'map'
  return 'home'
}

export default function App() {
  const { pathname } = useLocation()
  return (
    <div className="app-shell">
      <Header />
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/fields" element={<FieldsIndex />} />
          <Route path="/field/:field" element={<FieldPage />} />
          <Route path="/milestone/:id" element={<MilestonePage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </Suspense>
      <Mascot tipKey={tipKeyForPath(pathname)} />
    </div>
  )
}
