import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import ProductGrid from "../../components/products/ProductGrid";
import SearchBar from "../../components/products/SearchBar";
import { fetchProducts, fetchBrands, fetchSubcategories } from "../../api/api";

export default function AllProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [brand, setBrand] = useState(searchParams.get("brand") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [brands, setBrands] = useState([]);
  const [subcategory, setSubcategory] = useState(searchParams.get("subcategory") || "");
  const [subcategories, setSubcategories] = useState([]);
  const [page, setPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const ITEMS_PER_PAGE = 100;

  // Load brands on mount
  useEffect(() => {
    fetchBrands()
      .then((data) => setBrands(data.brands || []))
      .catch(() => {});
  }, []);

  // Sync ALL filter params from URL when navigating (e.g. nav dropdown links)
  useEffect(() => {
    const urlCat = searchParams.get("category") || "";
    const urlSearch = searchParams.get("search") || "";
    const urlSubcat = searchParams.get("subcategory") || "";
    const urlBrand = searchParams.get("brand") || "";
    if (urlCat !== category) setCategory(urlCat);
    if (urlSearch !== search) setSearch(urlSearch);
    if (urlSubcat !== subcategory) setSubcategory(urlSubcat);
    if (urlBrand !== brand) setBrand(urlBrand);
  }, [searchParams]);

  // Load subcategory OPTIONS when category changes (for the dropdown filter)
  useEffect(() => {
    if (!category) {
      setSubcategories([]);
      // Only reset subcategory if URL doesn't have one
      if (!searchParams.get("subcategory")) setSubcategory("");
      return;
    }
    fetchSubcategories(category)
      .then((data) => setSubcategories(data.subcategories || []))
      .catch(() => setSubcategories([]));
  }, [category]);

  useEffect(() => {
    setLoading(true);
    const params = { page, limit: ITEMS_PER_PAGE };
    if (search) params.search = search;
    if (brand) params.brand = brand;
    if (category) params.category = category;
    if (subcategory) params.subcategory = subcategory;
    if (minPrice) params.minPrice = minPrice;
    if (maxPrice) params.maxPrice = maxPrice;
    fetchProducts(params)
      .then((data) => {
        setProducts(Array.isArray(data) ? data : data.products || []);
        setTotalProducts(data.total || 0);
      })
      .catch(() => { setProducts([]); setTotalProducts(0); })
      .finally(() => setLoading(false));
  }, [search, brand, category, subcategory, minPrice, maxPrice, page]);

  // Reset to page 1 when any filter changes
  const resetPage = () => setPage(1);

  const clearFilters = () => {
    setBrand("");
    setCategory("");
    setSubcategory("");
    setSubcategories([]);
    setMinPrice("");
    setMaxPrice("");
    setSearch("");
    setPage(1);
    setSearchParams({});
  };

  const hasFilters = brand || minPrice || maxPrice || search || category || subcategory;

  // Go to Top button visibility
  const [showGoTop, setShowGoTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowGoTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const pageTitle = category ? category : "All Products";

  return (
    <>
      <section className="page-banner">
        <div className="container">
          <h1>{pageTitle}</h1>
          <p>Browse our full catalogue of wholesale clearance sportswear.</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SearchBar onSearch={(v) => { setSearch(v); resetPage(); }} placeholder="Search all products…" />

          {/* Filter bar */}
          <div className="filter-bar">
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                resetPage();
                if (e.target.value) {
                  setSearchParams({ category: e.target.value });
                } else {
                  searchParams.delete("category");
                  setSearchParams(searchParams);
                }
              }}
              className="filter-select"
            >
              <option value="">All Categories</option>
              <option value="FOOTWEAR">Footwear</option>
              <option value="CLOTHING">Clothing</option>
              <option value="LICENSED TEAM CLOTHING">Licensed Team Clothing</option>
              <option value="ACCESSORIES">Accessories</option>
              <option value="B GRADE">B Grade</option>
              <option value="JOB LOTS">Job Lots</option>
              <option value="SPORTS">Sports</option>
            </select>

            {subcategories.length > 0 && (
              <select
                value={subcategory}
                onChange={(e) => { setSubcategory(e.target.value); resetPage(); }}
                className="filter-select"
              >
                <option value="">All Sub-categories</option>
                {subcategories.map((sc) => (
                  <option key={sc._id} value={sc.name}>
                    {sc.name}
                  </option>
                ))}
              </select>
            )}

            <select
              value={brand}
                onChange={(e) => { setBrand(e.target.value); resetPage(); }}
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
                onChange={(e) => { setMinPrice(e.target.value); resetPage(); }}
                min="0"
                step="0.01"
                className="filter-input"
              />
              <span style={{ color: "#9ca3af" }}>–</span>
              <input
                type="number"
                placeholder="Max £"
                value={maxPrice}
                onChange={(e) => { setMaxPrice(e.target.value); resetPage(); }}
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
                {totalProducts === 0
                  ? "No products found"
                  : `Showing ${(page - 1) * ITEMS_PER_PAGE + 1}–${Math.min(page * ITEMS_PER_PAGE, totalProducts)} of ${totalProducts} product${totalProducts !== 1 ? "s" : ""}`}
              </p>
              <ProductGrid products={products} />

              {/* Pagination */}
              {totalProducts > ITEMS_PER_PAGE && (
                <div className="pagination">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => { setPage((p) => Math.max(1, p - 1)); scrollToTop(); }}
                    disabled={page <= 1}
                  >
                    ← Previous
                  </button>
                  <span className="pagination-info">
                    Page {page} of {Math.ceil(totalProducts / ITEMS_PER_PAGE)}
                  </span>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => { setPage((p) => p + 1); scrollToTop(); }}
                    disabled={page >= Math.ceil(totalProducts / ITEMS_PER_PAGE)}
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Go to Top button */}
      {showGoTop && (
        <button
          onClick={scrollToTop}
          className="go-to-top-btn"
          aria-label="Scroll to top"
          title="Back to top"
        >
          ↑ Top
        </button>
      )}
    </>
  );
}
