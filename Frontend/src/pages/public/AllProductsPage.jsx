import { useEffect, useState } from "react";
import ProductGrid from "../../components/products/ProductGrid";
import SearchBar from "../../components/products/SearchBar";
import { fetchProducts } from "../../api/api";

export default function AllProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    fetchProducts(params)
      .then((data) =>
        setProducts(Array.isArray(data) ? data : data.products || []),
      )
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <>
      <section className="page-banner">
        <div className="container">
          <h1>All Products</h1>
          <p>Browse our full catalogue of wholesale clearance sportswear.</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SearchBar onSearch={setSearch} placeholder="Search all products…" />
          {loading ? (
            <div className="loading-center">
              <div className="spinner" />
            </div>
          ) : (
            <>
              <p
                style={{
                  color: "#6b7280",
                  marginBottom: "1rem",
                  fontSize: "0.9rem",
                }}
              >
                {products.length} product{products.length !== 1 ? "s" : ""}{" "}
                found
              </p>
              <ProductGrid products={products} />
            </>
          )}
        </div>
      </section>
    </>
  );
}
