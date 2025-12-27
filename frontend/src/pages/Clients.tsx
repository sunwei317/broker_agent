import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronRight,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Trash2,
  User,
  X
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Client, clientsApi } from '../api/client'
import Button from '../components/Button'
import Card from '../components/Card'

export default function Clients() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [newClient, setNewClient] = useState({ name: '', email: '', phone: '', address: '' })
  const [error, setError] = useState('')
  
  const { data: clients, isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsApi.list().then(r => r.data),
  })
  
  const createMutation = useMutation({
    mutationFn: (data: Partial<Client>) => clientsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      setShowModal(false)
      setNewClient({ name: '', email: '', phone: '', address: '' })
      setError('')
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to create client. Please try again.')
    },
  })
  
  const deleteMutation = useMutation({
    mutationFn: (id: number) => clientsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
  
  const filteredClients = clients?.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Clients</h1>
          <p className="text-midnight-400 mt-1">
            Manage your client database
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" />
          Add Client
        </Button>
      </div>
      
      {/* Search */}
      <Card className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-500" />
          <input
            type="text"
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-midnight-500 focus:outline-none focus:border-gold-500/50"
          />
        </div>
      </Card>
      
      {/* Clients Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredClients.length === 0 ? (
        <Card className="text-center py-16">
          <User className="w-16 h-16 text-midnight-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No clients yet</h3>
          <p className="text-midnight-400 mb-6">
            Add your first client to get started
          </p>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4" />
            Add Client
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client, index) => (
            <motion.div
              key={client.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card 
                hover
                onClick={() => navigate(`/clients/${client.id}`)}
                className="group relative cursor-pointer"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold-500/20 to-gold-600/20 flex items-center justify-center group-hover:from-gold-500/30 group-hover:to-gold-600/30 transition-all">
                    <User className="w-6 h-6 text-gold-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">{client.name}</h3>
                    {client.email && (
                      <div className="flex items-center gap-2 mt-1 text-sm text-midnight-400">
                        <Mail className="w-3 h-3" />
                        <span className="truncate">{client.email}</span>
                      </div>
                    )}
                    {client.phone && (
                      <div className="flex items-center gap-2 mt-1 text-sm text-midnight-400">
                        <Phone className="w-3 h-3" />
                        <span>{client.phone}</span>
                      </div>
                    )}
                    {client.address && (
                      <div className="flex items-center gap-2 mt-1 text-sm text-midnight-400">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">{client.address}</span>
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-midnight-500 group-hover:text-gold-400 transition-colors" />
                </div>
                <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                  <span className="text-xs text-midnight-500">
                    Added {format(new Date(client.created_at), 'MMM d, yyyy')}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm('Delete this client?')) {
                        deleteMutation.mutate(client.id)
                      }
                    }}
                    className="p-1 text-midnight-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
      
      {/* Add Client Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass rounded-2xl p-6 max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xl font-semibold text-white">Add New Client</h2>
                <button
                  onClick={() => { setShowModal(false); setError(''); }}
                  className="p-2 text-midnight-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  setError('')
                  createMutation.mutate(newClient)
                }}
                className="space-y-4"
              >
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm"
                  >
                    {error}
                  </motion.div>
                )}
                <div>
                  <label className="block text-sm text-midnight-400 mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={newClient.name}
                    onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-gold-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-midnight-400 mb-1">Email *</label>
                  <input
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-gold-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-midnight-400 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-gold-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-midnight-400 mb-1">Address</label>
                  <input
                    type="text"
                    value={newClient.address}
                    onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-gold-500/50"
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <Button type="submit" loading={createMutation.isPending} className="flex-1">
                    Add Client
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

