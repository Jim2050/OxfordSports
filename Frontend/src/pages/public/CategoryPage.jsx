import { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import ProductGrid from "../../components/products/ProductGrid";
import { fetchProductsByCategory } from "../../api/api";

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
  // Extract slug from params or from pathname
  const slug = params.slug || location.pathname.replace(/^\//, "");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const meta = CATEGORY_META[slug] || { title: slug, subtitle: "" };

  useEffect(() => {
    setLoading(true);
    fetchProductsByCategory(slug)
      .then((data) =>
        setProducts(Array.isArray(data) ? data : data.products || []),
      )
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [slug]);

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
