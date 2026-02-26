import { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import ProductGrid from "../../components/products/ProductGrid";
import SearchBar from "../../components/products/SearchBar";
import { fetchProducts } from "../../api/api";

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

  return (
    <>
      <section className="page-banner">
        <div className="container">
          <h1>{meta.title}</h1>
          <p>{meta.subtitle}</p>
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
