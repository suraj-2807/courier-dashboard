import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import AppRoutes from './routes/AppRoutes'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30000
    }
  }
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              fontFamily: "'Inter', sans-serif",
              fontSize: '13px',
              borderRadius: '12px',
              padding: '12px 16px'
            },
            success: {
              iconTheme: {
                primary: '#10B981',
                secondary: '#ECFDF5'
              }
            },
            error: {
              iconTheme: {
                primary: '#EF4444',
                secondary: '#FEF2F2'
              }
            }
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
