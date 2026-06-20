import { Link, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from './LanguageSwitcher'

export default function Header() {
  const { t } = useTranslation()
  return (
    <header className="site-header">
      <Link to="/" className="brand">
        <span className="brand-mark" aria-hidden="true">🧭</span>
        <span className="brand-text">{t('app.name')}</span>
      </Link>

      <nav className="site-nav" aria-label="Primary">
        <NavLink to="/timeline" className="nav-link">{t('nav.timeline')}</NavLink>
        <NavLink to="/fields" className="nav-link">{t('nav.fields')}</NavLink>
        <NavLink to="/map" className="nav-link">{t('nav.map')}</NavLink>
        <NavLink to="/math" className="nav-link">{t('nav.math')}</NavLink>
        <NavLink to="/gallery" className="nav-link">{t('nav.gallery')}</NavLink>
      </nav>

      <LanguageSwitcher />
    </header>
  )
}
