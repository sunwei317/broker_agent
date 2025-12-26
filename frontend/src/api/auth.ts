import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1/auth',
  headers: {
    'Content-Type': 'application/json',
  },
})

export interface SignupData {
  email: string
  password: string
  full_name?: string
}

export interface LoginData {
  email: string
  password: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

export interface UserResponse {
  id: number
  email: string
  full_name?: string
  is_verified: boolean
  is_active: boolean
  created_at: string
}

export interface MessageResponse {
  message: string
}

export const authApi = {
  signup: (data: SignupData) => 
    api.post<MessageResponse>('/signup', data),
  
  login: (data: LoginData) => 
    api.post<TokenResponse>('/login/json', data),
  
  verifyEmail: (token: string) => 
    api.post<MessageResponse>('/verify-email', { token }),
  
  resendVerification: (email: string) => 
    api.post<MessageResponse>('/resend-verification', { email }),
  
  getMe: (token: string) => 
    api.get<UserResponse>('/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    }),
  
  logout: () => 
    api.post<MessageResponse>('/logout'),
}

export default api

