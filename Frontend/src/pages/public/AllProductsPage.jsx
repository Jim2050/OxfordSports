import { useEffect, useState } from "react";
import ProductGrid from "../../components/products/ProductGrid";
import SearchBar from "../../components/products/SearchBar";
import { fetchProducts, fetchBrands } from "../../api/api";

export default function AllProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [brand, setBrand] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [brands, setBrands] = useState([]);

  // Load brands on mount
  useEffect(() => {
    fetchBrands()
      .then((data) => setBrands(data.brands || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (brand) params.brand = brand;
    if (minPrice) params.minPrice = minPrice;
    if (maxPrice) params.maxPrice = maxPrice;
    fetchProducts(params)
      .then((data) =>
        setProducts(Array.isArray(data) ? data : data.products || []),
      )
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [search, brand, minPrice, maxPrice]);

  const clearFilters = () => {
    setBrand("");
    setMinPrice("");
    setMaxPrice("");
    setSearch("");
  };

  const hasFilters = brand || minPrice || maxPrice || search;

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

          {/* Filter bar */}
          <div className="filter-bar">
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="filter-select"
            >
              <option value="">All Brands</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            <div className="filter-price-range">
              <input
                type="number"
                placeholder="Min £"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                min="0"
                step="0.01"
                className="filter-input"
              />
              <span style={{ color: "#9ca3af" }}>–</span>
              <input
                type="number"
                placeholder="Max £"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                min="0"
                step="0.01"
                className="filter-input"
              />
            </div>

            {hasFilters && (
              <button className="btn btn-sm btn-outline" onClick={clearFilters}>
                Clear Filters
              </button>
            )}
          </div>

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
