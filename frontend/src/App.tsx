import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Clients from './pages/Clients'
import ConversationDetail from './pages/ConversationDetail'
import Conversations from './pages/Conversations'
import Dashboard from './pages/Dashboard'
import Documents from './pages/Documents'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="conversations" element={<Conversations />} />
        <Route path="conversations/:id" element={<ConversationDetail />} />
        <Route path="clients" element={<Clients />} />
        <Route path="documents" element={<Documents />} />
      </Route>
    </Routes>
  )
}

export default App

