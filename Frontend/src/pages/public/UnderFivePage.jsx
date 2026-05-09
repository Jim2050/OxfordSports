import { useEffect, useState } from "react";
import ProductGrid from "../../components/products/ProductGrid";
import SearchBar from "../../components/products/SearchBar";
import { fetchProducts } from "../../api/api";

export default function UnderFivePage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    setLoading(true);
    const params = { maxPrice: 5 };
    if (search) params.search = search;
    fetchProducts(params)
      .then((data) =>
        setProducts(Array.isArray(data) ? data : data.products || []),
      )
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [search, refreshTick]);

  useEffect(() => {
    const handleCatalogRefresh = () => setRefreshTick((tick) => tick + 1);
    window.addEventListener("catalog:refresh", handleCatalogRefresh);
    return () => window.removeEventListener("catalog:refresh", handleCatalogRefresh);
  }, []);

  return (
    <>
      <section className="page-banner">
        <div className="container">
          <h1>Under £5</h1>
          <p>Incredible deals on branded sportswear — all under £5.</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SearchBar
            onSearch={setSearch}
            placeholder="Search under £5 deals…"
          />
          {loading ? (
            <div className="loading-center">
              <div className="spinner" />
            </div>
          ) : (
            <ProductGrid products={products} />
          )}
        </div>
      </section>
    </>
  );
}
