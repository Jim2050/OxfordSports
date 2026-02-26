import { useEffect, useState } from "react";
import ProductGrid from "../../components/products/ProductGrid";
import { fetchUnderFive } from "../../api/api";

export default function UnderFivePage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUnderFive()
      .then((data) =>
        setProducts(Array.isArray(data) ? data : data.products || []),
      )
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
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
