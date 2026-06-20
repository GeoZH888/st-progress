import { lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Header from './components/Header'
import Mascot from './components/Mascot'
import AdminGuard from './components/AdminGuard'
import { Loading } from './components/Status'
import Home from './pages/Home'
import Timeline from './pages/Timeline'
import FieldsIndex from './pages/FieldsIndex'
import FieldPage from './pages/FieldPage'
import MilestonePage from './pages/MilestonePage'

// Map view is code-split: it pulls in Leaflet, which we don't want in the
// initial bundle for users who only browse the Timeline / By Field views.
const MapPage = lazy(() => import('./pages/MapPage'))
// Math RAG page is code-split: KaTeX CSS + parser only load if visited.
const MathSearch = lazy(() => import('./pages/MathSearch'))
// 3D gallery is code-split: three.js + r3f + drei stay out of the main bundle.
const Gallery = lazy(() => import('./pages/Gallery'))
// Admin section is code-split as one chunk per page.
const AdminLogin     = lazy(() => import('./pages/admin/Login'))
const AdminLayout    = lazy(() => import('./pages/admin/AdminLayout'))
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const AdminMilestones = lazy(() => import('./pages/admin/MilestonesAdmin'))
const AdminFigures   = lazy(() => import('./pages/admin/FiguresAdmin'))
const AdminLocations = lazy(() => import('./pages/admin/LocationsAdmin'))
const AdminRag       = lazy(() => import('./pages/admin/RagAdmin'))
const AdminSurfaces  = lazy(() => import('./pages/admin/SurfacesAdmin'))

// Maps the current path to a mascot tip key (trilingual, pulled from i18n).
function tipKeyForPath(pathname) {
  if (pathname.startsWith('/timeline')) return 'timeline'
  if (pathname.startsWith('/fields') || pathname.startsWith('/field')) return 'fields'
  if (pathname.startsWith('/milestone')) return 'milestone'
  if (pathname.startsWith('/map')) return 'map'
  if (pathname.startsWith('/math')) return 'math'
  if (pathname.startsWith('/gallery')) return 'gallery'
  return 'home'
}

export default function App() {
  const { pathname } = useLocation()
  // The /admin section has its own sidebar shell, so hide the public Header
  // and Mascot there to avoid double chrome.
  const isAdmin = pathname.startsWith('/admin')
  return (
    <div className="app-shell">
      {!isAdmin && <Header />}
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/fields" element={<FieldsIndex />} />
          <Route path="/field/:field" element={<FieldPage />} />
          <Route path="/milestone/:id" element={<MilestonePage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/math" element={<MathSearch />} />
          <Route path="/gallery" element={<Gallery />} />

          {/* Admin section */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin"
            element={
              <AdminGuard>
                <AdminLayout />
              </AdminGuard>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="milestones" element={<AdminMilestones />} />
            <Route path="figures" element={<AdminFigures />} />
            <Route path="locations" element={<AdminLocations />} />
            <Route path="rag" element={<AdminRag />} />
            <Route path="surfaces" element={<AdminSurfaces />} />
          </Route>

          <Route path="*" element={<Home />} />
        </Routes>
      </Suspense>
      {!isAdmin && <Mascot tipKey={tipKeyForPath(pathname)} />}
    </div>
  )
}
