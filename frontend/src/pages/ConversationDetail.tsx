import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import {
    ArrowLeft,
    Briefcase,
    Calendar,
    CheckCircle2,
    DollarSign,
    Edit3,
    Home,
    Mail,
    Play,
    Save,
    User,
    X
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { conversationsApi, extractionsApi, processingApi } from '../api/client'
import Button from '../components/Button'
import Card from '../components/Card'
import StatusBadge from '../components/StatusBadge'

export default function ConversationDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'transcript' | 'extraction' | 'actions'>('transcript')
  const [editingSegment, setEditingSegment] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [generatedEmail, setGeneratedEmail] = useState<{ subject: string; body: string } | null>(null)
  
  const { data: conversation, isLoading } = useQuery({
    queryKey: ['conversation', id],
    queryFn: () => conversationsApi.get(Number(id)).then(r => r.data),
    enabled: !!id,
  })
  
  const { data: extractions } = useQuery({
    queryKey: ['extractions', id],
    queryFn: () => extractionsApi.listMortgage(Number(id)).then(r => r.data),
    enabled: !!id && conversation?.status === 'completed',
  })
  
  const { data: actions } = useQuery({
    queryKey: ['actions', id],
    queryFn: () => extractionsApi.listActions(Number(id)).then(r => r.data),
    enabled: !!id && conversation?.status === 'completed',
  })
  
  const processMutation = useMutation({
    mutationFn: () => processingApi.processConversation(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation', id] })
    },
  })
  
  const emailMutation = useMutation({
    mutationFn: () => processingApi.generateEmail(Number(id)).then(r => r.data),
    onSuccess: (data) => {
      setGeneratedEmail(data)
    },
  })
  
  const updateSegmentMutation = useMutation({
    mutationFn: ({ segmentId, text }: { segmentId: number; text: string }) =>
      conversationsApi.updateSegment(Number(id), segmentId, { verified_text: text, is_verified: 1 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation', id] })
      setEditingSegment(null)
    },
  })
  
  const updateExtractionMutation = useMutation({
    mutationFn: ({ extractionId, data }: { extractionId: number; data: Record<string, unknown> }) =>
      extractionsApi.updateMortgage(extractionId, { ...data, is_verified: 1 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extractions', id] })
    },
  })
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  
  if (!conversation) {
    return (
      <div className="text-center py-24">
        <p className="text-midnight-400">Conversation not found</p>
      </div>
    )
  }
  
  const extraction = extractions?.[0]
  
  const formatCurrency = (value?: number) => {
    if (!value) return '—'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/conversations')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold text-white">
            {conversation.original_filename || `Conversation #${conversation.id}`}
          </h1>
          <p className="text-midnight-400 text-sm mt-1">
            {format(new Date(conversation.created_at), 'MMMM d, yyyy at h:mm a')}
          </p>
        </div>
        <StatusBadge status={conversation.status} />
        
        {conversation.status === 'pending' && (
          <Button onClick={() => processMutation.mutate()} loading={processMutation.isPending}>
            <Play className="w-4 h-4" />
            Process
          </Button>
        )}
        
        {conversation.status === 'completed' && (
          <Button 
            variant="secondary" 
            onClick={() => emailMutation.mutate()} 
            loading={emailMutation.isPending}
          >
            <Mail className="w-4 h-4" />
            Generate Email
          </Button>
        )}
      </div>
      
      {/* Processing Status */}
      {['transcribing', 'diarizing', 'extracting'].includes(conversation.status) && (
        <Card className="border-blue-500/30 bg-blue-500/10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
            <div>
              <p className="font-medium text-white">Processing in progress...</p>
              <p className="text-sm text-midnight-400">
                Currently {conversation.status}. This may take a few minutes.
              </p>
            </div>
          </div>
        </Card>
      )}
      
      {/* Error Message */}
      {conversation.status === 'failed' && conversation.error_message && (
        <Card className="border-red-500/30 bg-red-500/10">
          <p className="text-red-400">{conversation.error_message}</p>
        </Card>
      )}
      
      {/* Tabs */}
      {conversation.status === 'completed' && (
        <>
          <div className="flex gap-2 border-b border-white/10 pb-1">
            {(['transcript', 'extraction', 'actions'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 font-medium rounded-t-lg transition-colors ${
                  activeTab === tab
                    ? 'bg-white/10 text-white border-b-2 border-gold-500'
                    : 'text-midnight-400 hover:text-white'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          
          <AnimatePresence mode="wait">
            {/* Transcript Tab */}
            {activeTab === 'transcript' && (
              <motion.div
                key="transcript"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card>
                  <h2 className="font-display text-xl font-semibold text-white mb-4">
                    Transcript
                  </h2>
                  <div className="space-y-4">
                    {conversation.segments?.map((segment) => (
                      <div
                        key={segment.id}
                        className={`p-4 rounded-xl ${
                          segment.speaker === 'zach'
                            ? 'bg-gold-500/10 border-l-2 border-gold-500'
                            : 'bg-blue-500/10 border-l-2 border-blue-500'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <User className={`w-4 h-4 ${
                              segment.speaker === 'zach' ? 'text-gold-400' : 'text-blue-400'
                            }`} />
                            <span className={`text-sm font-medium ${
                              segment.speaker === 'zach' ? 'text-gold-400' : 'text-blue-400'
                            }`}>
                              {segment.speaker === 'zach' ? 'Zach (Broker)' : 'Client'}
                            </span>
                            {segment.start_time !== undefined && (
                              <span className="text-xs text-midnight-500">
                                {Math.floor(segment.start_time / 60)}:{String(Math.floor(segment.start_time % 60)).padStart(2, '0')}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {segment.is_verified === 1 && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            )}
                            {editingSegment !== segment.id && (
                              <button
                                onClick={() => {
                                  setEditingSegment(segment.id)
                                  setEditText(segment.verified_text || segment.text || '')
                                }}
                                className="p-1 text-midnight-400 hover:text-white"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {editingSegment === segment.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white resize-none focus:outline-none focus:border-gold-500"
                              rows={3}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => updateSegmentMutation.mutate({ segmentId: segment.id, text: editText })}
                                loading={updateSegmentMutation.isPending}
                              >
                                <Save className="w-3 h-3" />
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingSegment(null)}
                              >
                                <X className="w-3 h-3" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-white">
                            {segment.verified_text || segment.text}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            )}
            
            {/* Extraction Tab */}
            {activeTab === 'extraction' && extraction && (
              <motion.div
                key="extraction"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                {/* Loan Details */}
                <Card>
                  <div className="flex items-center gap-2 mb-4">
                    <DollarSign className="w-5 h-5 text-gold-400" />
                    <h3 className="font-display text-lg font-semibold text-white">Loan Details</h3>
                    {extraction.is_verified === 1 && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 ml-auto" />
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-midnight-400">Loan Amount</span>
                      <span className="text-white font-medium">{formatCurrency(extraction.loan_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-midnight-400">Interest Rate</span>
                      <span className="text-white font-medium">{extraction.interest_rate ? `${extraction.interest_rate}%` : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-midnight-400">Loan Term</span>
                      <span className="text-white font-medium">{extraction.loan_term_years ? `${extraction.loan_term_years} years` : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-midnight-400">Loan Type</span>
                      <span className="text-white font-medium capitalize">{extraction.loan_type || '—'}</span>
                    </div>
                  </div>
                  {extraction.is_verified !== 1 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-4 w-full"
                      onClick={() => updateExtractionMutation.mutate({ extractionId: extraction.id, data: {} })}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Verify
                    </Button>
                  )}
                </Card>
                
                {/* Property Details */}
                <Card>
                  <div className="flex items-center gap-2 mb-4">
                    <Home className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-display text-lg font-semibold text-white">Property Details</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-midnight-400">Property Type</span>
                      <span className="text-white font-medium capitalize">{extraction.property_type || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-midnight-400">Purchase Price</span>
                      <span className="text-white font-medium">{formatCurrency(extraction.purchase_price)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-midnight-400">Down Payment</span>
                      <span className="text-white font-medium">
                        {formatCurrency(extraction.down_payment)}
                        {extraction.down_payment_percentage && ` (${extraction.down_payment_percentage}%)`}
                      </span>
                    </div>
                  </div>
                </Card>
                
                {/* Borrower Details */}
                <Card>
                  <div className="flex items-center gap-2 mb-4">
                    <Briefcase className="w-5 h-5 text-purple-400" />
                    <h3 className="font-display text-lg font-semibold text-white">Borrower Details</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-midnight-400">Annual Income</span>
                      <span className="text-white font-medium">{formatCurrency(extraction.borrower_income)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-midnight-400">Employment</span>
                      <span className="text-white font-medium">{extraction.borrower_employment || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-midnight-400">Credit Score</span>
                      <span className="text-white font-medium">{extraction.credit_score_range || '—'}</span>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
            
            {/* Actions Tab */}
            {activeTab === 'actions' && (
              <motion.div
                key="actions"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card>
                  <h2 className="font-display text-xl font-semibold text-white mb-4">
                    Action Items
                  </h2>
                  {actions && actions.length > 0 ? (
                    <div className="space-y-3">
                      {actions.map((action) => (
                        <div
                          key={action.id}
                          className="p-4 rounded-xl bg-white/5 border border-white/10"
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              action.status === 'completed' 
                                ? 'bg-emerald-500/20' 
                                : 'bg-amber-500/20'
                            }`}>
                              {action.status === 'completed' ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Calendar className="w-4 h-4 text-amber-400" />
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="text-white">{action.description}</p>
                              <div className="flex items-center gap-3 mt-2">
                                {action.category && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-midnight-300">
                                    {action.category}
                                  </span>
                                )}
                                {action.assignee && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    action.assignee === 'client'
                                      ? 'bg-purple-500/20 text-purple-400'
                                      : 'bg-blue-500/20 text-blue-400'
                                  }`}>
                                    {action.assignee}
                                  </span>
                                )}
                                {action.priority && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    action.priority === 'high'
                                      ? 'bg-red-500/20 text-red-400'
                                      : 'bg-gray-500/20 text-gray-400'
                                  }`}>
                                    {action.priority}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-midnight-400">No action items extracted</p>
                  )}
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
      
      {/* Generated Email Modal */}
      <AnimatePresence>
        {generatedEmail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
            onClick={() => setGeneratedEmail(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl font-semibold text-white">Generated Email</h2>
                <button
                  onClick={() => setGeneratedEmail(null)}
                  className="p-2 text-midnight-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-midnight-400">Subject</label>
                  <p className="text-white font-medium mt-1">{generatedEmail.subject}</p>
                </div>
                <div>
                  <label className="text-sm text-midnight-400">Body</label>
                  <pre className="mt-1 text-white whitespace-pre-wrap font-sans">
                    {generatedEmail.body}
                  </pre>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button onClick={() => navigator.clipboard.writeText(generatedEmail.body)}>
                  Copy to Clipboard
                </Button>
                <Button variant="secondary" onClick={() => setGeneratedEmail(null)}>
                  Close
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

