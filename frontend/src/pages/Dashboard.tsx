import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { motion } from 'framer-motion'
import {
    CheckCircle2,
    Clock,
    FileAudio,
    MessageSquare,
    TrendingUp,
    Users
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { clientsApi, conversationsApi, extractionsApi } from '../api/client'
import Card from '../components/Card'
import StatusBadge from '../components/StatusBadge'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export default function Dashboard() {
  const navigate = useNavigate()
  
  const { data: conversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => conversationsApi.list().then(r => r.data),
  })
  
  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsApi.list().then(r => r.data),
  })
  
  const { data: actions } = useQuery({
    queryKey: ['actions'],
    queryFn: () => extractionsApi.listActions().then(r => r.data),
  })
  
  const pendingActions = actions?.filter(a => a.status === 'pending') || []
  const completedConversations = conversations?.filter(c => c.status === 'completed') || []
  const recentConversations = conversations?.slice(0, 5) || []
  
  const stats = [
    {
      label: 'Total Conversations',
      value: conversations?.length || 0,
      icon: MessageSquare,
      color: 'from-blue-500 to-cyan-500',
    },
    {
      label: 'Active Clients',
      value: clients?.length || 0,
      icon: Users,
      color: 'from-emerald-500 to-teal-500',
    },
    {
      label: 'Processed',
      value: completedConversations.length,
      icon: CheckCircle2,
      color: 'from-gold-500 to-amber-500',
    },
    {
      label: 'Pending Actions',
      value: pendingActions.length,
      icon: Clock,
      color: 'from-purple-500 to-pink-500',
    },
  ]
  
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="font-display text-3xl font-bold text-white mb-2">
          Welcome back, Zach
        </h1>
        <p className="text-midnight-400">
          Here's what's happening with your conversations today.
        </p>
      </motion.div>
      
      {/* Stats Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className="relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-midnight-400 text-sm">{stat.label}</p>
                <p className="text-3xl font-display font-bold text-white mt-1">
                  {stat.value}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
            {/* Decorative gradient */}
            <div className={`absolute -bottom-10 -right-10 w-32 h-32 rounded-full bg-gradient-to-br ${stat.color} opacity-10 blur-2xl`} />
          </Card>
        ))}
      </motion.div>
      
      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Conversations */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl font-semibold text-white">
                Recent Conversations
              </h2>
              <button 
                onClick={() => navigate('/conversations')}
                className="text-gold-400 hover:text-gold-300 text-sm font-medium"
              >
                View all →
              </button>
            </div>
            
            {recentConversations.length === 0 ? (
              <div className="text-center py-12">
                <FileAudio className="w-12 h-12 text-midnight-500 mx-auto mb-4" />
                <p className="text-midnight-400">No conversations yet</p>
                <p className="text-midnight-500 text-sm mt-1">
                  Upload an audio file to get started
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentConversations.map((conv) => (
                  <motion.div
                    key={conv.id}
                    whileHover={{ x: 4 }}
                    onClick={() => navigate(`/conversations/${conv.id}`)}
                    className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-midnight-600 to-midnight-700 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-gold-400" />
                      </div>
                      <div>
                        <p className="font-medium text-white">
                          {conv.original_filename || `Conversation #${conv.id}`}
                        </p>
                        <p className="text-sm text-midnight-400">
                          {formatDistanceToNow(new Date(conv.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={conv.status} size="sm" />
                  </motion.div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
        
        {/* Pending Action Items */}
        <motion.div variants={itemVariants}>
          <Card>
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="w-5 h-5 text-gold-400" />
              <h2 className="font-display text-xl font-semibold text-white">
                Pending Actions
              </h2>
            </div>
            
            {pendingActions.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                <p className="text-midnight-400">All caught up!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingActions.slice(0, 5).map((action) => (
                  <div
                    key={action.id}
                    className="p-3 rounded-lg bg-white/5 border-l-2 border-gold-500"
                  >
                    <p className="text-sm text-white line-clamp-2">
                      {action.description}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        action.assignee === 'client' 
                          ? 'bg-purple-500/20 text-purple-400' 
                          : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {action.assignee || 'Unassigned'}
                      </span>
                      {action.priority && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          action.priority === 'high'
                            ? 'bg-red-500/20 text-red-400'
                            : action.priority === 'medium'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {action.priority}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    </motion.div>
  )
}

