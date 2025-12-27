import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import {
    FileAudio,
    Filter,
    Play,
    Search,
    Trash2,
    Upload,
    User,
    X
} from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clientsApi, conversationsApi, processingApi } from '../api/client'
import Button from '../components/Button'
import Card from '../components/Card'
import StatusBadge from '../components/StatusBadge'

export default function Conversations() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState('')
  
  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations', statusFilter],
    queryFn: () => conversationsApi.list(statusFilter ? { status: statusFilter } : undefined).then(r => r.data),
    // Auto-refresh every 3 seconds if any conversation is processing
    refetchInterval: (query) => {
      const data = query.state.data
      const hasProcessing = data?.some(c => 
        ['transcribing', 'diarizing', 'extracting'].includes(c.status)
      )
      return hasProcessing ? 3000 : false
    },
  })
  
  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsApi.list().then(r => r.data),
  })
  
  const uploadMutation = useMutation({
    mutationFn: ({ file, clientId }: { file: File; clientId: number }) => 
      conversationsApi.upload(file, clientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      setShowUploadModal(false)
      setSelectedClientId(null)
      setSelectedFile(null)
      setUploadError('')
    },
    onError: (err: any) => {
      setUploadError(err.response?.data?.detail || 'Upload failed. Please try again.')
    },
  })
  
  const processMutation = useMutation({
    mutationFn: (id: number) => processingApi.processConversation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
  
  const deleteMutation = useMutation({
    mutationFn: (id: number) => conversationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }
  
  const handleUploadSubmit = () => {
    if (!selectedClientId) {
      setUploadError('Please select a client')
      return
    }
    if (!selectedFile) {
      setUploadError('Please select an audio file')
      return
    }
    setUploadError('')
    uploadMutation.mutate({ file: selectedFile, clientId: selectedClientId })
  }
  
  const openUploadModal = () => {
    setShowUploadModal(true)
    setSelectedClientId(null)
    setSelectedFile(null)
    setUploadError('')
  }
  
  const filteredConversations = conversations?.filter(c => 
    !searchQuery || 
    c.original_filename?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []
  
  // Get client name by ID
  const getClientName = (clientId?: number) => {
    if (!clientId || !clients) return null
    const client = clients.find(c => c.id === clientId)
    return client?.name
  }
  
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Conversations</h1>
          <p className="text-midnight-400 mt-1">
            Manage and process your recorded conversations
          </p>
        </div>
        <Button onClick={openUploadModal}>
          <Upload className="w-4 h-4" />
          Upload Audio
        </Button>
      </div>
      
      {/* Filters */}
      <Card className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-500" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-midnight-500 focus:outline-none focus:border-gold-500/50"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-midnight-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-gold-500/50"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="transcribing">Transcribing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </Card>
      
      {/* Upload Progress */}
      <AnimatePresence>
        {uploadMutation.isPending && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="border-gold-500/30 bg-gold-500/10">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gold-500/20 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-gold-400 animate-bounce" />
                </div>
                <div>
                  <p className="font-medium text-white">Uploading file...</p>
                  <p className="text-sm text-midnight-400">Please wait while we process your upload</p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Conversations List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredConversations.length === 0 ? (
        <Card className="text-center py-16">
          <FileAudio className="w-16 h-16 text-midnight-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No conversations yet</h3>
          <p className="text-midnight-400 mb-6">
            Upload your first audio file to get started
          </p>
          <Button onClick={openUploadModal}>
            <Upload className="w-4 h-4" />
            Upload Audio
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredConversations.map((conv, index) => (
            <motion.div
              key={conv.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card 
                hover
                onClick={() => navigate(`/conversations/${conv.id}`)}
                className="group"
              >
                <div className="flex items-center gap-6">
                  {/* Icon */}
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-midnight-700 to-midnight-800 flex items-center justify-center group-hover:from-gold-500/20 group-hover:to-gold-600/20 transition-all">
                    <FileAudio className="w-7 h-7 text-gold-400" />
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">
                      {conv.original_filename || `Conversation #${conv.id}`}
                    </h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-midnight-400">
                      {conv.client_id && getClientName(conv.client_id) && (
                        <>
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {getClientName(conv.client_id)}
                          </span>
                          <span>•</span>
                        </>
                      )}
                      <span>{format(new Date(conv.created_at), 'MMM d, yyyy h:mm a')}</span>
                      <span>•</span>
                      <span>{formatDuration(conv.duration_seconds)}</span>
                    </div>
                  </div>
                  
                  {/* Status */}
                  <StatusBadge status={conv.status} />
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {(conv.status === 'pending' || conv.status === 'failed') && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          processMutation.mutate(conv.id)
                        }}
                        loading={processMutation.isPending}
                      >
                        <Play className="w-4 h-4" />
                        Process
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm('Delete this conversation?')) {
                          deleteMutation.mutate(conv.id)
                        }
                      }}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
      
      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
            onClick={() => setShowUploadModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass rounded-2xl p-6 max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xl font-semibold text-white">Upload Conversation</h2>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="p-2 text-midnight-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                {uploadError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm"
                  >
                    {uploadError}
                  </motion.div>
                )}
                
                {/* Client Selection */}
                <div>
                  <label className="block text-sm text-midnight-400 mb-2">
                    Select Client <span className="text-red-400">*</span>
                  </label>
                  {clients && clients.length > 0 ? (
                    <select
                      value={selectedClientId || ''}
                      onChange={(e) => setSelectedClientId(Number(e.target.value) || null)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-gold-500/50"
                    >
                      <option value="">-- Select a client --</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name} {client.email ? `(${client.email})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm">
                      No clients found. Please{' '}
                      <button
                        onClick={() => {
                          setShowUploadModal(false)
                          navigate('/clients')
                        }}
                        className="underline hover:text-yellow-300"
                      >
                        add a client
                      </button>{' '}
                      first.
                    </div>
                  )}
                </div>
                
                {/* File Selection */}
                <div>
                  <label className="block text-sm text-midnight-400 mb-2">
                    Audio File <span className="text-red-400">*</span>
                  </label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`
                      border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
                      ${selectedFile 
                        ? 'border-emerald-500/50 bg-emerald-500/10' 
                        : 'border-white/20 hover:border-gold-500/50 hover:bg-white/5'
                      }
                    `}
                  >
                    {selectedFile ? (
                      <div className="flex items-center justify-center gap-3">
                        <FileAudio className="w-8 h-8 text-emerald-400" />
                        <div className="text-left">
                          <p className="text-white font-medium truncate max-w-[200px]">
                            {selectedFile.name}
                          </p>
                          <p className="text-sm text-midnight-400">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-10 h-10 text-midnight-500 mx-auto mb-2" />
                        <p className="text-midnight-400">
                          Click to select audio file
                        </p>
                        <p className="text-midnight-500 text-sm mt-1">
                          MP3, WAV, M4A, OGG
                        </p>
                      </>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".mp3,.wav,.m4a,.ogg"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleUploadSubmit}
                    loading={uploadMutation.isPending}
                    disabled={!selectedClientId || !selectedFile}
                    className="flex-1"
                  >
                    <Upload className="w-4 h-4" />
                    Upload
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setShowUploadModal(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
