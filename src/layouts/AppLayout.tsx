import { useEffect, useRef, useState } from 'react'
import { CircleHelp, LogOut, Menu, WifiOff, X } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { appConfig } from '../config/app'
import { useAuth } from '../features/auth/AuthProvider'

export function AppLayout() {
  const { role, signOut } = useAuth()
  const { pathname } = useLocation()
  const compact = pathname === '/python-ide'
  const [openPath, setOpenPath] = useState<string | null>(null)
  const menuOpen = openPath === pathname
  const [online, setOnline] = useState(() => navigator.onLine)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState('')
  const content = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update); window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  useEffect(() => {
    const container = content.current
    const orient = () => {
      const heading = container?.querySelector('h1')
      if (!heading || /^Loading/i.test(heading.textContent ?? '')) return false
      document.title = `${heading.textContent} | ${appConfig.appName}`
      heading.tabIndex = -1; heading.focus({ preventScroll: true }); window.scrollTo(0, 0)
      return true
    }
    if (orient()) return
    const observer = new MutationObserver(() => { if (orient()) observer.disconnect() })
    if (container) observer.observe(container, { childList: true, characterData: true, subtree: true })
    return () => observer.disconnect()
  }, [pathname])
  const leave = async () => {
    setSigningOut(true); setError('')
    try { await signOut() } catch { setError('Could not sign out. Check your connection and try again.') }
    finally { setSigningOut(false) }
  }
  return <div className={`app-shell ${compact ? 'ide-app-shell' : ''}`}>
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); content.current?.focus(); content.current?.scrollIntoView() }}>Skip to main content</a>
    <header className="topbar" onKeyDown={event => { if (event.key === 'Escape' && menuOpen) { setOpenPath(null); menu.current?.focus() } }}>
      <NavLink className="brand" to="/" aria-label={`${appConfig.appName} home`}>{appConfig.appName}</NavLink>
      <button ref={menu} className="icon-button navigation-toggle" aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={() => setOpenPath(menuOpen ? null : pathname)}>{menuOpen ? <X size={20}/> : <Menu size={20}/>} {menuOpen ? 'Close menu' : 'Menu'}</button>
      <nav id="primary-navigation" className={`classroom-nav ${menuOpen ? 'menu-open' : ''}`} aria-label="Main navigation" onClick={event => { const link = (event.target as HTMLElement).closest('a'); if (link) { setOpenPath(null); if (link.hash === window.location.hash) menu.current?.focus() } }}>
        <NavLink end to={role === 'student' ? '/student' : '/teacher'}>Dashboard</NavLink><NavLink to="/assessments">Quiz & Code</NavLink><NavLink to="/python-ide">Python IDE</NavLink>
        {(role === 'teacher' || role === 'admin') && <><NavLink to="/teacher/courses">Courses & students</NavLink><NavLink to="/teacher/submissions">Student code</NavLink><NavLink to="/teacher/workspaces">Student workspaces</NavLink></>}
        <NavLink to="/help"><CircleHelp size={16} aria-hidden="true"/> Help</NavLink>
      </nav>
      <button className="icon-button sign-out" disabled={signingOut} onClick={() => void leave()}><LogOut size={18} aria-hidden="true"/> {signingOut ? 'Signing out…' : 'Sign out'}</button>
    </header>
    {!online && <div className="connection-notice" role="status"><WifiOff size={18} aria-hidden="true"/> You’re offline. Cloud saves and submissions need a connection. Keep this tab open and check the save status when you reconnect.</div>}
    {error && <p className="alert" role="alert">{error}</p>}
    <div id="main-content" ref={content} tabIndex={-1}><Outlet/></div>
    <footer className="app-footer"><span>APU CS Studio · High school computer science</span><Link to="/help">Help & accessibility</Link></footer>
  </div>
}
