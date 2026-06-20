import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { signOut, useSession } from '../../lib/auth'
import './Admin.css'

export default function AdminLayout() {
  const { t } = useTranslation()
  const { session } = useSession()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <header className="admin-sidebar-head">
          <strong>{t('admin.shellTitle')}</strong>
          <span className="admin-user" title={session?.user?.email}>
            {session?.user?.email}
          </span>
        </header>

        <nav className="admin-nav" aria-label="Admin">
          <NavLink end to="/admin" className="admin-nav-link">
            <span aria-hidden="true">📊</span> {t('admin.nav.dashboard')}
          </NavLink>
          <NavLink to="/admin/milestones" className="admin-nav-link">
            <span aria-hidden="true">🏛️</span> {t('admin.nav.milestones')}
          </NavLink>
          <NavLink to="/admin/figures" className="admin-nav-link">
            <span aria-hidden="true">🧑‍🔬</span> {t('admin.nav.figures')}
          </NavLink>
          <NavLink to="/admin/locations" className="admin-nav-link">
            <span aria-hidden="true">📍</span> {t('admin.nav.locations')}
          </NavLink>
          <NavLink to="/admin/rag" className="admin-nav-link">
            <span aria-hidden="true">📚</span> {t('admin.nav.rag')}
          </NavLink>
        </nav>

        <footer className="admin-sidebar-foot">
          <a href="/" className="admin-btn admin-btn-ghost">
            ← {t('admin.backToSite')}
          </a>
          <button type="button" className="admin-btn admin-btn-ghost" onClick={handleSignOut}>
            {t('admin.signOut')}
          </button>
        </footer>
      </aside>

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  )
}
