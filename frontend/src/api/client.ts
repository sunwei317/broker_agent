import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Types
export interface Client {
  id: number
  name: string
  email?: string
  phone?: string
  address?: string
  created_at: string
  updated_at?: string
}

export interface TranscriptSegment {
  id: number
  speaker?: string
  start_time?: number
  end_time?: number
  text?: string
  confidence?: number
  is_verified: number
  verified_text?: string
}

export interface Conversation {
  id: number
  client_id?: number
  google_drive_file_id?: string
  original_filename?: string
  file_path?: string
  duration_seconds?: number
  status: 'pending' | 'transcribing' | 'diarizing' | 'extracting' | 'completed' | 'failed'
  error_message?: string
  raw_transcript?: string
  recorded_at?: string
  created_at: string
  updated_at?: string
  processed_at?: string
  segments?: TranscriptSegment[]
}

export interface MortgageExtraction {
  id: number
  conversation_id: number
  loan_amount?: number
  interest_rate?: number
  loan_term_years?: number
  loan_type?: string
  property_type?: string
  property_address?: string
  purchase_price?: number
  down_payment?: number
  down_payment_percentage?: number
  borrower_income?: number
  borrower_employment?: string
  credit_score_range?: string
  additional_data?: Record<string, unknown>
  is_verified: number
  verified_by?: string
  verified_at?: string
  corrections?: Record<string, unknown>
  extraction_confidence?: number
  created_at: string
  updated_at?: string
}

export interface ActionItem {
  id: number
  conversation_id: number
  description: string
  category?: string
  assignee?: string
  due_date?: string
  priority?: string
  status: string
  completed_at?: string
  is_verified: number
  verified_text?: string
  source_segment_id?: number
  created_at: string
  updated_at?: string
}

export interface DocumentItem {
  id: number
  checklist_id: number
  name: string
  description?: string
  category?: string
  is_required: number
  status: string
  received_at?: string
  notes?: string
  created_at: string
  updated_at?: string
}

export interface DocumentChecklist {
  id: number
  client_id: number
  conversation_id?: number
  loan_type?: string
  title?: string
  notes?: string
  items: DocumentItem[]
  created_at: string
  updated_at?: string
}

// API Functions
export const clientsApi = {
  list: () => api.get<Client[]>('/clients'),
  get: (id: number) => api.get<Client>(`/clients/${id}`),
  create: (data: Partial<Client>) => api.post<Client>('/clients', data),
  update: (id: number, data: Partial<Client>) => api.patch<Client>(`/clients/${id}`, data),
  delete: (id: number) => api.delete(`/clients/${id}`),
}

export const conversationsApi = {
  list: (params?: { status?: string; client_id?: number }) => 
    api.get<Conversation[]>('/conversations', { params }),
  get: (id: number) => api.get<Conversation>(`/conversations/${id}`),
  upload: (file: File, clientId?: number) => {
    const formData = new FormData()
    formData.append('file', file)
    if (clientId) formData.append('client_id', String(clientId))
    return api.post<Conversation>('/conversations/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  delete: (id: number) => api.delete(`/conversations/${id}`),
  getSegments: (id: number) => api.get<TranscriptSegment[]>(`/conversations/${id}/segments`),
  updateSegment: (conversationId: number, segmentId: number, data: Partial<TranscriptSegment>) =>
    api.patch<TranscriptSegment>(`/conversations/${conversationId}/segments/${segmentId}`, data),
}

export const processingApi = {
  processConversation: (id: number) => api.post(`/processing/conversations/${id}/process`),
  generateEmail: (id: number) => api.post<{ subject: string; body: string }>(
    `/processing/conversations/${id}/generate-email`
  ),
  listGoogleDriveFiles: (folderId?: string) => 
    api.get('/processing/google-drive/files', { params: { folder_id: folderId } }),
  importFromGoogleDrive: (fileId: string, clientId?: number) =>
    api.post(`/processing/google-drive/import/${fileId}`, null, { params: { client_id: clientId } }),
}

export const extractionsApi = {
  listMortgage: (conversationId?: number) => 
    api.get<MortgageExtraction[]>('/extractions/mortgage', { params: { conversation_id: conversationId } }),
  getMortgage: (id: number) => api.get<MortgageExtraction>(`/extractions/mortgage/${id}`),
  updateMortgage: (id: number, data: Partial<MortgageExtraction>) =>
    api.patch<MortgageExtraction>(`/extractions/mortgage/${id}`, data),
  listActions: (conversationId?: number) =>
    api.get<ActionItem[]>('/extractions/actions', { params: { conversation_id: conversationId } }),
  getAction: (id: number) => api.get<ActionItem>(`/extractions/actions/${id}`),
  updateAction: (id: number, data: Partial<ActionItem>) =>
    api.patch<ActionItem>(`/extractions/actions/${id}`, data),
}

export const documentsApi = {
  listChecklists: (clientId?: number) =>
    api.get<DocumentChecklist[]>('/documents/checklists', { params: { client_id: clientId } }),
  getChecklist: (id: number) => api.get<DocumentChecklist>(`/documents/checklists/${id}`),
  createChecklist: (data: { client_id: number; loan_type?: string; title?: string }) =>
    api.post<DocumentChecklist>('/documents/checklists', data),
  updateItem: (id: number, data: Partial<DocumentItem>) =>
    api.patch<DocumentItem>(`/documents/items/${id}`, data),
  getLoanTypeDocuments: () => api.get('/documents/loan-types'),
}

export default api

