import { useState } from 'react'
import { LogOut, Menu } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { appConfig } from '../config/app'
import { useAuth } from '../features/auth/AuthProvider'

export function AppLayout() {
  const { role, signOut } = useAuth()
  const location = useLocation()
  const compact = location.pathname === '/python-ide'
  const [menuOpen, setMenuOpen] = useState(false)
  return <div className={`app-shell ${compact ? 'ide-app-shell' : ''}`}><header className="topbar"><NavLink className="brand" to="/">{appConfig.appName}</NavLink>{compact && <button className="icon-button" aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={() => setMenuOpen(open => !open)}><Menu size={18}/>Classroom</button>}<nav id="primary-navigation" className={menuOpen ? 'menu-open' : ''} onClick={() => setMenuOpen(false)} aria-label="Primary"><NavLink to={role==='student'?'/student':'/teacher'}>Dashboard</NavLink><NavLink to="/assessments">Quiz & Code</NavLink><NavLink to="/python-ide">Python IDE</NavLink>{(role==='teacher'||role==='admin')&&<><NavLink to="/teacher/courses">Courses & students</NavLink><NavLink to="/teacher/submissions">Student code</NavLink><NavLink to="/teacher/workspaces">Student workspaces</NavLink></>}</nav><button className="icon-button" onClick={()=>void signOut()}><LogOut size={18}/> Sign out</button></header><Outlet/></div>
}
