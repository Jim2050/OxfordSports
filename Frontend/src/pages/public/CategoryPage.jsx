import { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import ProductGrid from "../../components/products/ProductGrid";
import SearchBar from "../../components/products/SearchBar";
import { fetchProducts, resolveImageUrl } from "../../api/api";

const PLACEHOLDER_BG = "https://placehold.co/300x300/1a1281/ffffff?text=•";

const CATEGORY_META = {
  "rugby-category": {
    title: "Rugby Replica Clothing",
    subtitle:
      "Authentic adidas rugby clearance stock. Brand new with tags at wholesale prices.",
  },
  football: {
    title: "Football Replica Clothing",
    subtitle:
      "Authentic adidas football club clearance stock. Brand new with tags at wholesale prices.",
  },
  footwear: {
    title: "adidas Footwear",
    subtitle:
      "Authentic adidas footwear clearance stock. Brand new with tags at wholesale prices.",
  },
};

export default function CategoryPage() {
  const params = useParams();
  const location = useLocation();
  const slug = params.slug || location.pathname.replace(/^\//, "");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const meta = CATEGORY_META[slug] || {
    title: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    subtitle: "",
  };

  useEffect(() => {
    setLoading(true);
    const params = { category: slug };
    if (search) params.search = search;
    fetchProducts(params)
      .then((data) =>
        setProducts(Array.isArray(data) ? data : data.products || []),
      )
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [slug, search]);

  // Pick up to 4 products with images for the background showcase
  const bgProducts = products
    .filter((p) => p.imageUrl || p.image)
    .slice(0, 4)
    .map((p) => resolveImageUrl(p.imageUrl || p.image) || PLACEHOLDER_BG);

  // Pad to 4 if not enough images
  while (bgProducts.length < 4) bgProducts.push(PLACEHOLDER_BG);

  return (
    <>
      <section className="page-banner category-banner">
        {/* Four background product thumbnails */}
        <div className="category-bg-grid" aria-hidden="true">
          {bgProducts.map((src, i) => (
            <div key={i} className="category-bg-item">
              <img src={src} alt="" loading="lazy" />
            </div>
          ))}
        </div>
        <div className="container" style={{ position: "relative", zIndex: 2 }}>
          <h1>{meta.title}</h1>
          <p>{meta.subtitle}</p>
          <span className="category-count">
            {loading
              ? "…"
              : `${products.length} product${products.length !== 1 ? "s" : ""}`}
          </span>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SearchBar
            onSearch={setSearch}
            placeholder={`Search ${meta.title}…`}
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
