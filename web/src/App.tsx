import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import { LandingPage } from './pages/LandingPage'
import { UploadPage } from './pages/UploadPage'
import { ReviewPage } from './pages/ReviewPage'
import { CookModePage } from './pages/CookModePage'
import { RecipeDetailPage } from './pages/RecipeDetailPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { LibraryPage } from './pages/LibraryPage'
import { ProfilePage } from './pages/ProfilePage'
import { SharedRecipePage } from './pages/SharedRecipePage'
import { SharedCookPage } from './pages/SharedCookPage'
import { CollectionsPage } from './pages/CollectionsPage'
import { CollectionDetailPage } from './pages/CollectionDetailPage'
import { CommunityRecipesPage } from './pages/CommunityRecipesPage'
import { VerifyEmailPage } from './pages/VerifyEmailPage'
import { VerifyEmailConfirmPage } from './pages/VerifyEmailConfirmPage'
import { AuthMobilePage } from './pages/AuthMobilePage'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/auth/mobile" element={<AuthMobilePage />} />
            <Route path="/recipes" element={<LibraryPage />} />
            <Route path="/collections" element={<CollectionsPage />} />
            <Route path="/collections/:id" element={<CollectionDetailPage />} />
            <Route path="/community" element={<CommunityRecipesPage />} />
            <Route path="/r/:slug" element={<SharedRecipePage />} />
            <Route path="/r/:slug/cook" element={<SharedCookPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/verify-email/confirm" element={<VerifyEmailConfirmPage />} />
            <Route path="/new" element={<UploadPage />} />
            <Route path="/new/review" element={<ReviewPage />} />
            <Route path="/recipes/:id" element={<RecipeDetailPage />} />
            <Route path="/cook/:id" element={<CookModePage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
