import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
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
      <Toaster position="top-right" />
      <Routes>
        {/* Admin — no header/footer */}
        <Route path="/admin" element={<AdminPage />} />

        {/* Public pages with layout */}
        <Route
          path="*"
          element={
            <Layout>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/rugby-category" element={<CategoryPage />} />
                <Route path="/football" element={<CategoryPage />} />
                <Route path="/footwear" element={<CategoryPage />} />
                <Route path="/under-5" element={<UnderFivePage />} />
                <Route path="/products" element={<AllProductsPage />} />
                <Route path="/product/:sku" element={<ProductPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/:slug" element={<CategoryPage />} />
              </Routes>
            </Layout>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
