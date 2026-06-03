import axios from 'axios'

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000'

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('voyageiq_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('voyageiq_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const authAPI = {
  login: (email: string, password: string) => api.post('/api/auth/login', { email, password }),
  register: (data: object) => api.post('/api/auth/register', data),
  me: () => api.get('/api/auth/me'),
}

export const vesselsAPI = {
  list: () => api.get('/api/vessels'),
  get: (id: string) => api.get(`/api/vessels/${id}`),
  create: (data: object) => api.post('/api/vessels', data),
  update: (id: string, data: object) => api.put(`/api/vessels/${id}`, data),
  getPositions: (id: string) => api.get(`/api/vessels/${id}/positions`),
  getPerformance: (id: string) => api.get(`/api/vessels/${id}/performance`),
  getHealth: (id: string) => api.get(`/api/vessels/${id}/health`),
}

export const voyagesAPI = {
  list: () => api.get('/api/voyages'),
  get: (id: string) => api.get(`/api/voyages/${id}`),
  create: (data: object) => api.post('/api/voyages', data),
  getNoonReports: (id: string) => api.get(`/api/voyages/${id}/noon-reports`),
  addNoonReport: (id: string, data: object) => api.post(`/api/voyages/${id}/noon-reports`, data),
  getPerformance: (id: string) => api.get(`/api/voyages/${id}/performance`),
  getClaims: (id: string) => api.get(`/api/voyages/${id}/claims`),
}

export const analyticsAPI = {
  dashboard: () => api.get('/api/analytics/dashboard'),
  fuel: (vesselId?: string) => api.get('/api/analytics/fuel', { params: { vessel_id: vesselId } }),
  performance: (vesselId?: string) => api.get('/api/analytics/performance', { params: { vessel_id: vesselId } }),
  weatherImpact: () => api.get('/api/analytics/weather-impact'),
}

export const claimsAPI = {
  list: (params?: object) => api.get('/api/claims', { params }),
  get: (id: string) => api.get(`/api/claims/${id}`),
  create: (data: object) => api.post('/api/claims', data),
  updateStatus: (id: string, status: string, notes?: string) =>
    api.put(`/api/claims/${id}/status`, { status, notes }),
  detect: (voyageId: string) => api.get(`/api/claims/detect/${voyageId}`),
}

export const optimizationAPI = {
  calculate:     (data: object) => api.post('/api/optimization/calculate', data),
  generateRoute: (data: object) => api.post('/api/optimization/route', data),
  fuelSimulator: (data: object) => api.post('/api/optimization/fuel-simulator', data),
  getPorts:      ()             => api.get('/api/optimization/ports'),
}

export const weatherAPI = {
  current: (lat: number, lon: number) => api.get('/api/weather/current', { params: { lat, lon } }),
  routeRisk: (params: object) => api.get('/api/weather/route-risk', { params }),
  forecast: (data: object) => api.post('/api/weather/forecast', data),
  windImpact: (data: object) => api.post('/api/weather/wind-impact', data),
  attribution: (data: object) => api.post('/api/weather/attribution', data),
  gridEnhance: (data: object) => api.post('/api/weather/grid-enhance', data),
}

export const copilotAPI = {
  chat: (message: string, conversationId?: string, vesselId?: string) =>
    api.post('/api/copilot/chat', { message, conversation_id: conversationId, vessel_id: vesselId }),
  getConversations: () => api.get('/api/copilot/conversations'),
  getConversation: (id: string) => api.get(`/api/copilot/conversations/${id}`),
}

export const uploadsAPI = {
  uploadReport: (formData: FormData) =>
    api.post('/api/uploads/report', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getUpload: (id: string) => api.get(`/api/uploads/${id}`),
  confirmUpload: (id: string, corrections?: object) =>
    api.post(`/api/uploads/${id}/confirm`, { corrections }),
}

export const reportsAPI = {
  generate: (voyageId: string, format: 'pdf' | 'excel' | 'csv') =>
    api.get(`/api/reports/generate/${voyageId}`, { params: { format }, responseType: 'blob' }),
  templates: () => api.get('/api/reports/templates'),
}

export default api
