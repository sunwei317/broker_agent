import { motion } from 'framer-motion'
import {
    FileCheck,
    LayoutDashboard,
    LogOut,
    MessageSquare,
    Mic,
    User,
    Users
} from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/conversations', icon: MessageSquare, label: 'Conversations' },
  { to: '/clients', icon: Users, label: 'Clients' },
  { to: '/documents', icon: FileCheck, label: 'Documents' },
]

export default function Layout() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  
  const handleLogout = () => {
    logout()
    navigate('/login')
  }
  
  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 glass border-r border-white/10 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center">
              <Mic className="w-5 h-5 text-midnight-950" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg text-white">Broker Agent</h1>
              <p className="text-xs text-midnight-400">Conversation Intelligence</p>
            </div>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map(({ to, icon: Icon, label }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30'
                        : 'text-midnight-300 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        
        {/* User & Footer */}
        <div className="p-4 border-t border-white/10 space-y-2">
          {/* User info */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-500/30 to-gold-600/30 flex items-center justify-center">
              <User className="w-4 h-4 text-gold-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.full_name || user?.email || 'User'}
              </p>
              {user?.full_name && (
                <p className="text-xs text-midnight-500 truncate">{user.email}</p>
              )}
            </div>
          </div>
          
          {/* Logout */}
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-midnight-400 hover:bg-red-500/10 hover:text-red-400 transition-all w-full"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign out</span>
          </button>
        </div>
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-8"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  )
}
