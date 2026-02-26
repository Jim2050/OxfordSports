import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Header from "./components/layout/Header";
import Footer from "./components/layout/Footer";
import HomePage from "./pages/public/HomePage";
import CategoryPage from "./pages/public/CategoryPage";
import UnderFivePage from "./pages/public/UnderFivePage";
import AllProductsPage from "./pages/public/AllProductsPage";
import ProductPage from "./pages/public/ProductPage";
import ContactPage from "./pages/public/ContactPage";
import RegisterPage from "./pages/public/RegisterPage";
import AdminPage from "./pages/admin/AdminPage";

function Layout({ children }) {
  return (
    <>
      <Header />
      <main style={{ minHeight: "60vh" }}>{children}</main>
      <Footer />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" />
        <Routes>
          {/* Admin — no header/footer */}
          <Route path="/admin" element={<AdminPage />} />

          {/* Public + protected pages with layout */}
          <Route
            path="*"
            element={
              <Layout>
                <Routes>
                  {/* Public pages */}
                  <Route path="/" element={<HomePage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route path="/register" element={<RegisterPage />} />

                  {/* Member-gated pages */}
                  <Route
                    path="/rugby-category"
                    element={
                      <ProtectedRoute>
                        <CategoryPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/football"
                    element={
                      <ProtectedRoute>
                        <CategoryPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/footwear"
                    element={
                      <ProtectedRoute>
                        <CategoryPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/under-5"
                    element={
                      <ProtectedRoute>
                        <UnderFivePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/products"
                    element={
                      <ProtectedRoute>
                        <AllProductsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/product/:sku"
                    element={
                      <ProtectedRoute>
                        <ProductPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/:slug"
                    element={
                      <ProtectedRoute>
                        <CategoryPage />
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </Layout>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
