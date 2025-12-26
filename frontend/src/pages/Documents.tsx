import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FileCheck,
  Plus,
  ChevronDown,
  ChevronRight,
  Check,
  X
} from 'lucide-react'
import { documentsApi, clientsApi } from '../api/client'
import Card from '../components/Card'
import Button from '../components/Button'
import StatusBadge from '../components/StatusBadge'

export default function Documents() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [expandedChecklists, setExpandedChecklists] = useState<Set<number>>(new Set())
  const [newChecklist, setNewChecklist] = useState({ client_id: 0, loan_type: '', title: '' })
  
  const { data: checklists, isLoading } = useQuery({
    queryKey: ['checklists'],
    queryFn: () => documentsApi.listChecklists().then(r => r.data),
  })
  
  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsApi.list().then(r => r.data),
  })
  
  const { data: loanTypeDocuments } = useQuery({
    queryKey: ['loanTypeDocuments'],
    queryFn: () => documentsApi.getLoanTypeDocuments().then(r => r.data),
  })
  
  const createMutation = useMutation({
    mutationFn: (data: { client_id: number; loan_type?: string; title?: string }) =>
      documentsApi.createChecklist(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklists'] })
      setShowModal(false)
      setNewChecklist({ client_id: 0, loan_type: '', title: '' })
    },
  })
  
  const updateItemMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      documentsApi.updateItem(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklists'] })
    },
  })
  
  const toggleChecklist = (id: number) => {
    const newExpanded = new Set(expandedChecklists)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedChecklists(newExpanded)
  }
  
  const getProgress = (items: { status: string }[]) => {
    if (items.length === 0) return 0
    const received = items.filter(i => ['received', 'reviewed', 'approved'].includes(i.status)).length
    return Math.round((received / items.length) * 100)
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Document Checklists</h1>
          <p className="text-midnight-400 mt-1">
            Track document requirements for each client
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" />
          New Checklist
        </Button>
      </div>
      
      {/* Checklists */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !checklists || checklists.length === 0 ? (
        <Card className="text-center py-16">
          <FileCheck className="w-16 h-16 text-midnight-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No checklists yet</h3>
          <p className="text-midnight-400 mb-6">
            Create a document checklist for your clients
          </p>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4" />
            New Checklist
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {checklists.map((checklist) => {
            const isExpanded = expandedChecklists.has(checklist.id)
            const progress = getProgress(checklist.items)
            const client = clients?.find(c => c.id === checklist.client_id)
            
            return (
              <motion.div
                key={checklist.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card>
                  {/* Header */}
                  <div
                    className="flex items-center gap-4 cursor-pointer"
                    onClick={() => toggleChecklist(checklist.id)}
                  >
                    <button className="p-1 text-midnight-400">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </button>
                    
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 flex items-center justify-center">
                      <FileCheck className="w-6 h-6 text-emerald-400" />
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">
                        {checklist.title || `${checklist.loan_type || 'Mortgage'} Checklist`}
                      </h3>
                      <p className="text-sm text-midnight-400">
                        {client?.name || 'Unknown Client'}
                        {checklist.loan_type && ` • ${checklist.loan_type.toUpperCase()}`}
                      </p>
                    </div>
                    
                    {/* Progress */}
                    <div className="flex items-center gap-4">
                      <div className="w-32">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-midnight-400">Progress</span>
                          <span className="text-white font-medium">{progress}%</span>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                          />
                        </div>
                      </div>
                      <span className="text-sm text-midnight-400">
                        {checklist.items.filter(i => i.status !== 'pending').length}/{checklist.items.length}
                      </span>
                    </div>
                  </div>
                  
                  {/* Items */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-6 pt-6 border-t border-white/10 space-y-3">
                          {checklist.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-4 p-3 rounded-xl bg-white/5"
                            >
                              <button
                                onClick={() => updateItemMutation.mutate({
                                  id: item.id,
                                  status: item.status === 'pending' ? 'received' : 'pending'
                                })}
                                className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${
                                  item.status !== 'pending'
                                    ? 'bg-emerald-500 border-emerald-500'
                                    : 'border-midnight-500 hover:border-emerald-500'
                                }`}
                              >
                                {item.status !== 'pending' && (
                                  <Check className="w-4 h-4 text-white" />
                                )}
                              </button>
                              
                              <div className="flex-1">
                                <p className={`font-medium ${
                                  item.status !== 'pending' ? 'text-midnight-400 line-through' : 'text-white'
                                }`}>
                                  {item.name}
                                </p>
                                {item.description && (
                                  <p className="text-sm text-midnight-500">{item.description}</p>
                                )}
                              </div>
                              
                              {item.category && (
                                <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-midnight-400">
                                  {item.category}
                                </span>
                              )}
                              
                              <StatusBadge status={item.status} size="sm" />
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
      
      {/* Create Checklist Modal */}
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
                <h2 className="font-display text-xl font-semibold text-white">New Document Checklist</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 text-midnight-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (newChecklist.client_id) {
                    createMutation.mutate({
                      client_id: newChecklist.client_id,
                      loan_type: newChecklist.loan_type || undefined,
                      title: newChecklist.title || undefined,
                    })
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm text-midnight-400 mb-1">Client *</label>
                  <select
                    required
                    value={newChecklist.client_id}
                    onChange={(e) => setNewChecklist({ ...newChecklist, client_id: Number(e.target.value) })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-gold-500/50"
                  >
                    <option value="">Select a client</option>
                    {clients?.map((client) => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm text-midnight-400 mb-1">Loan Type</label>
                  <select
                    value={newChecklist.loan_type}
                    onChange={(e) => setNewChecklist({ ...newChecklist, loan_type: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-gold-500/50"
                  >
                    <option value="">Select loan type</option>
                    {loanTypeDocuments && Object.keys(loanTypeDocuments).map((type) => (
                      <option key={type} value={type}>{type.toUpperCase()}</option>
                    ))}
                  </select>
                  <p className="text-xs text-midnight-500 mt-1">
                    Default documents will be added based on loan type
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm text-midnight-400 mb-1">Title (optional)</label>
                  <input
                    type="text"
                    value={newChecklist.title}
                    onChange={(e) => setNewChecklist({ ...newChecklist, title: e.target.value })}
                    placeholder="e.g., Home Purchase Documents"
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-midnight-500 focus:outline-none focus:border-gold-500/50"
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <Button type="submit" loading={createMutation.isPending} className="flex-1">
                    Create Checklist
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

