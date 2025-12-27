import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Edit3,
  FileAudio,
  Mail,
  MapPin,
  Phone,
  Play,
  Save,
  User,
  X
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { clientsApi, conversationsApi } from '../api/client'
import Button from '../components/Button'
import Card from '../components/Card'
import StatusBadge from '../components/StatusBadge'

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const clientId = Number(id)
  
  const [isEditing, setIsEditing] = useState(false)
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editAddress, setEditAddress] = useState('')
  
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
  
  const updateMutation = useMutation({
    mutationFn: (data: { email?: string; phone?: string; address?: string }) =>
      clientsApi.update(clientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', clientId] })
      setIsEditing(false)
    },
  })
  
  const startEditing = () => {
    if (client) {
      setEditEmail(client.email || '')
      setEditPhone(client.phone || '')
      setEditAddress(client.address || '')
      setIsEditing(true)
    }
  }
  
  const cancelEditing = () => {
    setIsEditing(false)
  }
  
  const saveChanges = () => {
    updateMutation.mutate({
      email: editEmail || undefined,
      phone: editPhone || undefined,
      address: editAddress || undefined,
    })
  }
  
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
          <div className="flex-1">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-2xl font-semibold text-white">{client.name}</h3>
                <p className="text-midnight-400 text-sm mt-1">
                  Added {format(new Date(client.created_at), 'MMMM d, yyyy')}
                </p>
              </div>
              {!isEditing ? (
                <Button variant="secondary" size="sm" onClick={startEditing}>
                  <Edit3 className="w-4 h-4" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveChanges} loading={updateMutation.isPending}>
                    <Save className="w-4 h-4" />
                    Save
                  </Button>
                  <Button variant="ghost" size="sm" onClick={cancelEditing}>
                    <X className="w-4 h-4" />
                    Cancel
                  </Button>
                </div>
              )}
            </div>
            
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-midnight-400 mb-1">Email</label>
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-midnight-500" />
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="client@example.com"
                      className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-midnight-500 focus:outline-none focus:border-gold-500/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-midnight-400 mb-1">Phone</label>
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-midnight-500" />
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                      className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-midnight-500 focus:outline-none focus:border-gold-500/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-midnight-400 mb-1">Address</label>
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-midnight-500" />
                    <input
                      type="text"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      placeholder="123 Main St, City, State"
                      className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-midnight-500 focus:outline-none focus:border-gold-500/50"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-midnight-300">
                  <Mail className="w-4 h-4 text-midnight-500" />
                  {client.email ? (
                    <a href={`mailto:${client.email}`} className="hover:text-gold-400">
                      {client.email}
                    </a>
                  ) : (
                    <span className="text-midnight-500 italic">No email</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-midnight-300">
                  <Phone className="w-4 h-4 text-midnight-500" />
                  {client.phone ? (
                    <a href={`tel:${client.phone}`} className="hover:text-gold-400">
                      {client.phone}
                    </a>
                  ) : (
                    <span className="text-midnight-500 italic">No phone</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-midnight-300">
                  <MapPin className="w-4 h-4 text-midnight-500" />
                  {client.address ? (
                    <span>{client.address}</span>
                  ) : (
                    <span className="text-midnight-500 italic">No address</span>
                  )}
                </div>
              </div>
            )}
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

