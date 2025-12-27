import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import {
    ArrowLeft,
    Calendar,
    CheckCircle2,
    DollarSign,
    Edit3,
    Mail,
    Play,
    RefreshCw,
    Save,
    Send,
    User,
    X
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { clientsApi, conversationsApi, extractionsApi, processingApi } from '../api/client'
import { useAuthStore } from '../store/authStore'
import Button from '../components/Button'
import Card from '../components/Card'
import StatusBadge from '../components/StatusBadge'

export default function ConversationDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const authUser = useAuthStore((state) => state.user)
  const [activeTab, setActiveTab] = useState<'transcript' | 'extraction' | 'actions'>('extraction')
  const [editingSegment, setEditingSegment] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [generatedEmail, setGeneratedEmail] = useState<{ subject: string; body: string } | null>(null)
  const [editableSubject, setEditableSubject] = useState('')
  const [editableBody, setEditableBody] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [highlightTerms, setHighlightTerms] = useState<string[]>([])
  const [hasEdits, setHasEdits] = useState(false)
  
  // Helper to format number with variations for matching
  const getNumberVariations = (num: number): string[] => {
    const variations: string[] = []
    variations.push(num.toString()) // 40000
    variations.push(num.toLocaleString()) // 40,000
    
    // Handle thousands (40k, 40K)
    if (num >= 1000) {
      const k = num / 1000
      if (Number.isInteger(k)) {
        variations.push(`${k}k`)
        variations.push(`${k}K`)
        variations.push(`${k} thousand`)
      }
    }
    
    // Dollar amounts
    variations.push(`$${num.toLocaleString()}`)
    variations.push(`$${num}`)
    
    return variations
  }
  
  // Function to go to transcript and highlight extraction data
  const verifyInTranscript = (extraction: any) => {
    const terms: string[] = []
    
    // Only highlight loan amount and loan term values
    if (extraction.loan_amount) {
      terms.push(...getNumberVariations(extraction.loan_amount))
    }
    if (extraction.loan_term_years) {
      terms.push(`${extraction.loan_term_years} year`)
      terms.push(`${extraction.loan_term_years}-year`)
      terms.push(`${extraction.loan_term_years} years`)
      terms.push(extraction.loan_term_years.toString())
    }
    
    setHighlightTerms([...new Set(terms.filter(t => t && t.length > 1))])
    setActiveTab('transcript')
  }
  
  // Function to highlight text with search terms
  const highlightText = (text: string) => {
    if (!highlightTerms.length || !text) return text
    
    let result = text
    
    // Sort terms by length (longest first) to avoid partial replacements
    const sortedTerms = [...highlightTerms].sort((a, b) => b.length - a.length)
    
    for (const term of sortedTerms) {
      // Create case-insensitive regex with word boundaries where possible
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`(${escapedTerm})`, 'gi')
      
      result = result.replace(regex, '<mark class="bg-gold-500/40 text-white px-1 rounded">$1</mark>')
    }
    
    return result
  }
  
  const { data: conversation, isLoading } = useQuery({
    queryKey: ['conversation', id],
    queryFn: () => conversationsApi.get(Number(id)).then(r => r.data),
    enabled: !!id,
    // Auto-refresh every 3 seconds while processing
    refetchInterval: (query) => {
      const data = query.state.data
      const isProcessing = data && ['transcribing', 'diarizing', 'extracting'].includes(data.status)
      return isProcessing ? 3000 : false
    },
  })
  
  const { data: client } = useQuery({
    queryKey: ['client', conversation?.client_id],
    queryFn: () => clientsApi.get(conversation!.client_id!).then(r => r.data),
    enabled: !!conversation?.client_id,
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
      setEditableSubject(data.subject)
      setEditableBody(data.body)
      setEmailSent(false)
    },
  })
  
  const sendEmailMutation = useMutation({
    mutationFn: () => processingApi.sendEmail(Number(id), {
      subject: editableSubject,
      body: editableBody,
      broker_email: authUser?.email
    }).then(r => r.data),
    onSuccess: (data) => {
      setEmailSent(true)
      console.log('Email sent to:', data.sent_to)
    },
  })
  
  const updateSegmentMutation = useMutation({
    mutationFn: ({ segmentId, text }: { segmentId: number; text: string }) =>
      conversationsApi.updateSegment(Number(id), segmentId, { verified_text: text, is_verified: 1 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation', id] })
      setEditingSegment(null)
      setHasEdits(true) // Track that an edit was made
    },
  })
  
  const reExtractMutation = useMutation({
    mutationFn: () => processingApi.reExtract(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extractions', id] })
      setHasEdits(false) // Reset edits flag after re-extraction
      setActiveTab('extraction') // Switch to extraction tab to show updated data
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
          <div className="flex items-center gap-3 mt-1">
            {client && (
              <Link 
                to={`/clients/${client.id}`}
                className="flex items-center gap-1.5 text-gold-400 hover:text-gold-300 text-sm font-medium"
              >
                <User className="w-4 h-4" />
                {client.name}
              </Link>
            )}
            {client && <span className="text-midnight-600">•</span>}
            <span className="text-midnight-400 text-sm">
              {format(new Date(conversation.created_at), 'MMM d, yyyy h:mm a')}
            </span>
          </div>
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
            {(['transcript', 'extraction', 'actions'] as const).map((tab) => {
              const tabLabels: Record<string, string> = {
                transcript: 'Transcript',
                extraction: 'Loan',
                actions: 'Actions'
              }
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 font-medium rounded-t-lg transition-colors ${
                    activeTab === tab
                      ? 'bg-white/10 text-white border-b-2 border-gold-500'
                      : 'text-midnight-400 hover:text-white'
                  }`}
                >
                  {tabLabels[tab]}
                </button>
              )
            })}
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
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display text-xl font-semibold text-white">
                      Transcript
                    </h2>
                    {highlightTerms.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setHighlightTerms([])}
                        className="text-gold-400"
                      >
                        <X className="w-4 h-4" />
                        Clear highlights
                      </Button>
                    )}
                  </div>
                  
                  {highlightTerms.length > 0 && extraction && (
                    <div className="mb-4 p-3 rounded-xl bg-gold-500/10 border border-gold-500/30 text-gold-400 text-sm flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Highlighting extracted values. Review and verify the data is correct.</span>
                      </div>
                      {extraction.is_verified !== 1 && (
                        <Button
                          size="sm"
                          onClick={() => {
                            updateExtractionMutation.mutate({ extractionId: extraction.id, data: {} })
                            setHighlightTerms([])
                          }}
                          loading={updateExtractionMutation.isPending}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Confirm Verified
                        </Button>
                      )}
                    </div>
                  )}
                  
                  {/* Re-extract button - shows when transcript has been edited */}
                  {hasEdits && (
                    <div className="mb-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Edit3 className="w-4 h-4" />
                        <span>Transcript has been modified. Re-extract to update loan details.</span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => reExtractMutation.mutate()}
                        loading={reExtractMutation.isPending}
                      >
                        <RefreshCw className="w-4 h-4" />
                        Re-extract
                      </Button>
                    </div>
                  )}
                  
                  <div className="space-y-4">
                    {conversation.segments?.map((segment) => (
                      <div
                        key={segment.id}
                        className={`p-4 rounded-xl ${
                          segment.speaker === 'user'
                            ? 'bg-gold-500/10 border-l-2 border-gold-500'
                            : 'bg-blue-500/10 border-l-2 border-blue-500'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <User className={`w-4 h-4 ${
                              segment.speaker === 'user' ? 'text-gold-400' : 'text-blue-400'
                            }`} />
                            <span className={`text-sm font-medium ${
                              segment.speaker === 'user' ? 'text-gold-400' : 'text-blue-400'
                            }`}>
                              {segment.speaker === 'user' ? (authUser?.full_name || 'User') : 'Client'}
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
                          <p 
                            className="text-white"
                            dangerouslySetInnerHTML={{ 
                              __html: highlightText(segment.verified_text || segment.text || '') 
                            }}
                          />
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
              >
                {/* Loan Details */}
                <Card className="max-w-md">
                  <div className="flex items-center gap-2 mb-4">
                    <DollarSign className="w-5 h-5 text-gold-400" />
                    <h3 className="font-display text-lg font-semibold text-white">Loan Details</h3>
                    {extraction.is_verified === 1 && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 ml-auto" />
                    )}
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 rounded-lg bg-white/5">
                      <span className="text-midnight-400">Loan Amount</span>
                      <span className="text-white font-semibold text-lg">{formatCurrency(extraction.loan_amount)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-white/5">
                      <span className="text-midnight-400">Loan Term</span>
                      <span className="text-white font-semibold text-lg">{extraction.loan_term_years ? `${extraction.loan_term_years} years` : '—'}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-white/5">
                      <span className="text-midnight-400">Loan Type</span>
                      <span className="text-white font-semibold text-lg uppercase">{extraction.loan_type || '—'}</span>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-6 w-full"
                    onClick={() => verifyInTranscript(extraction)}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {extraction.is_verified === 1 ? 'View in Transcript' : 'Verify in Transcript'}
                  </Button>
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
              className="glass rounded-2xl p-6 max-w-3xl w-full max-h-[85vh] overflow-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl font-semibold text-white">
                  {emailSent ? '✓ Email Sent!' : 'Review & Send Email'}
                </h2>
                <button
                  onClick={() => setGeneratedEmail(null)}
                  className="p-2 text-midnight-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {emailSent ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  </div>
                  <p className="text-white text-lg mb-2">Email sent successfully!</p>
                  <p className="text-midnight-400 text-sm">
                    The email has been sent to the client and you.
                  </p>
                  <Button 
                    variant="secondary" 
                    onClick={() => setGeneratedEmail(null)}
                    className="mt-6"
                  >
                    Close
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-midnight-400 mb-1">Subject</label>
                      <input
                        type="text"
                        value={editableSubject}
                        onChange={(e) => setEditableSubject(e.target.value)}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-gold-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-midnight-400 mb-1">Body</label>
                      <textarea
                        value={editableBody}
                        onChange={(e) => setEditableBody(e.target.value)}
                        rows={16}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white font-sans text-sm leading-relaxed resize-none focus:outline-none focus:border-gold-500/50"
                      />
                    </div>
                    
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-sm">
                      <p className="text-blue-400">
                        <Mail className="w-4 h-4 inline mr-2" />
                        This email will be sent to:
                      </p>
                      <ul className="mt-2 text-midnight-300 space-y-1">
                        {client?.email && (
                          <li>• Client: {client.email}</li>
                        )}
                        {authUser?.email && (
                          <li>• You: {authUser.email}</li>
                        )}
                      </ul>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 mt-6">
                    <Button 
                      onClick={() => sendEmailMutation.mutate()}
                      loading={sendEmailMutation.isPending}
                      disabled={!client?.email}
                    >
                      <Send className="w-4 h-4" />
                      Send Email
                    </Button>
                    <Button 
                      variant="secondary"
                      onClick={() => navigator.clipboard.writeText(editableBody)}
                    >
                      Copy to Clipboard
                    </Button>
                    <Button variant="ghost" onClick={() => setGeneratedEmail(null)}>
                      Cancel
                    </Button>
                  </div>
                  
                  {!client?.email && (
                    <p className="mt-3 text-sm text-amber-400">
                      ⚠️ Client has no email address. Please add one in the client details.
                    </p>
                  )}
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

