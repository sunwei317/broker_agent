import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  FileAudio,
  Mail,
  MapPin,
  Phone,
  Play,
  User
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { clientsApi, conversationsApi } from '../api/client'
import Button from '../components/Button'
import Card from '../components/Card'
import StatusBadge from '../components/StatusBadge'

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const clientId = Number(id)
  
  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => clientsApi.get(clientId).then(r => r.data),
    enabled: !!clientId,
  })
  
  const { data: conversations, isLoading: conversationsLoading } = useQuery({
    queryKey: ['conversations', { client_id: clientId }],
    queryFn: () => conversationsApi.list({ client_id: clientId }).then(r => r.data),
    enabled: !!clientId,
    // Auto-refresh every 3 seconds if any conversation is processing
    refetchInterval: (query) => {
      const data = query.state.data
      const hasProcessing = data?.some(c => 
        ['transcribing', 'diarizing', 'extracting'].includes(c.status)
      )
      return hasProcessing ? 3000 : false
    },
  })
  
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  
  if (clientLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  
  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-midnight-400">Client not found</p>
        <Button variant="secondary" onClick={() => navigate('/clients')} className="mt-4">
          Back to Clients
        </Button>
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/clients')}
          className="p-2 text-midnight-400 hover:text-white rounded-lg hover:bg-white/5"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-display text-3xl font-bold text-white">{client.name}</h1>
          <p className="text-midnight-400 mt-1">Client Details</p>
        </div>
      </div>
      
      {/* Client Info Card */}
      <Card>
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gold-500/20 to-gold-600/20 flex items-center justify-center">
            <User className="w-10 h-10 text-gold-400" />
          </div>
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-2xl font-semibold text-white">{client.name}</h3>
              <p className="text-midnight-400 text-sm mt-1">
                Added {format(new Date(client.created_at), 'MMMM d, yyyy')}
              </p>
            </div>
            <div className="space-y-2">
              {client.email && (
                <div className="flex items-center gap-3 text-midnight-300">
                  <Mail className="w-4 h-4 text-midnight-500" />
                  <a href={`mailto:${client.email}`} className="hover:text-gold-400">
                    {client.email}
                  </a>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-3 text-midnight-300">
                  <Phone className="w-4 h-4 text-midnight-500" />
                  <a href={`tel:${client.phone}`} className="hover:text-gold-400">
                    {client.phone}
                  </a>
                </div>
              )}
              {client.address && (
                <div className="flex items-center gap-3 text-midnight-300">
                  <MapPin className="w-4 h-4 text-midnight-500" />
                  <span>{client.address}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
      
      {/* Conversations Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-semibold text-white">
            Conversations
            {conversations && (
              <span className="ml-2 text-sm text-midnight-400 font-normal">
                ({conversations.length})
              </span>
            )}
          </h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/conversations')}
          >
            <Play className="w-4 h-4" />
            Upload New
          </Button>
        </div>
        
        {conversationsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : conversations && conversations.length > 0 ? (
          <div className="grid gap-3">
            {conversations.map((conv, index) => (
              <motion.div
                key={conv.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  hover
                  onClick={() => navigate(`/conversations/${conv.id}`)}
                  className="group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-midnight-700 to-midnight-800 flex items-center justify-center group-hover:from-gold-500/20 group-hover:to-gold-600/20 transition-all">
                      <FileAudio className="w-6 h-6 text-gold-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white truncate">
                        {conv.original_filename || `Conversation #${conv.id}`}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-midnight-400">
                        <span>{format(new Date(conv.created_at), 'MMM d, yyyy h:mm a')}</span>
                        <span>•</span>
                        <span>{formatDuration(conv.duration_seconds)}</span>
                      </div>
                    </div>
                    <StatusBadge status={conv.status} />
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <Card className="text-center py-12">
            <FileAudio className="w-12 h-12 text-midnight-600 mx-auto mb-3" />
            <p className="text-midnight-400">No conversations yet</p>
            <p className="text-midnight-500 text-sm mt-1">
              Upload an audio file to start
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}

