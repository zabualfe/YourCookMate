import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import { FeaturesProvider } from './context/FeaturesContext'
import { FeatureGate } from './components/FeatureGate'
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
import { AdminPage } from './pages/AdminPage'
import { BillingSuccessPage } from './pages/BillingSuccessPage'
import { PlansPage } from './pages/PlansPage'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <FeaturesProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route
                path="/login"
                element={
                  <FeatureGate flag="auth">
                    <LoginPage />
                  </FeatureGate>
                }
              />
              <Route
                path="/register"
                element={
                  <FeatureGate flag="registration">
                    <RegisterPage />
                  </FeatureGate>
                }
              />
              <Route path="/auth/mobile" element={<AuthMobilePage />} />
              <Route path="/recipes" element={<LibraryPage />} />
              <Route path="/collections" element={<CollectionsPage />} />
              <Route path="/collections/:id" element={<CollectionDetailPage />} />
              <Route
                path="/community"
                element={
                  <FeatureGate flag="community">
                    <CommunityRecipesPage />
                  </FeatureGate>
                }
              />
            <Route path="/r/:slug" element={<SharedRecipePage />} />
            <Route path="/r/:slug/cook" element={<SharedCookPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/plans" element={<PlansPage />} />
              <Route path="/billing/success" element={<BillingSuccessPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/verify-email/confirm" element={<VerifyEmailConfirmPage />} />
            <Route path="/new" element={<UploadPage />} />
            <Route path="/new/review" element={<ReviewPage />} />
            <Route path="/recipes/:id" element={<RecipeDetailPage />} />
            <Route path="/cook/:id" element={<CookModePage />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </FeaturesProvider>
    </QueryClientProvider>
  )
}
