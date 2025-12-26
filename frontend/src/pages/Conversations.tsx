import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import {
    FileAudio,
    Filter,
    Play,
    Search,
    Trash2,
    Upload
} from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { conversationsApi, processingApi } from '../api/client'
import Button from '../components/Button'
import Card from '../components/Card'
import StatusBadge from '../components/StatusBadge'

export default function Conversations() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  
  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations', statusFilter],
    queryFn: () => conversationsApi.list(statusFilter ? { status: statusFilter } : undefined).then(r => r.data),
  })
  
  const uploadMutation = useMutation({
    mutationFn: (file: File) => conversationsApi.upload(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
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
  
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      await uploadMutation.mutateAsync(file)
    }
  }
  
  const filteredConversations = conversations?.filter(c => 
    !searchQuery || 
    c.original_filename?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []
  
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
        <Button onClick={() => fileInputRef.current?.click()}>
          <Upload className="w-4 h-4" />
          Upload Audio
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,.wav,.m4a,.ogg"
          onChange={handleFileSelect}
          className="hidden"
        />
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
          <Button onClick={() => fileInputRef.current?.click()}>
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
                      <span>{format(new Date(conv.created_at), 'MMM d, yyyy h:mm a')}</span>
                      <span>•</span>
                      <span>{formatDuration(conv.duration_seconds)}</span>
                    </div>
                  </div>
                  
                  {/* Status */}
                  <StatusBadge status={conv.status} />
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {conv.status === 'pending' && (
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
    </div>
  )
}

