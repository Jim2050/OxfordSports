import { useIntersectionObserver } from "../../hooks/useIntersectionObserver";
import ProductCard from "./ProductCard";

function LazyProductCard({ product }) {
  const [ref, isIntersecting] = useIntersectionObserver({
    rootMargin: "200px",
    triggerOnce: true,
  });

  return (
    <div ref={ref} className="product-card-container" style={{ minHeight: "400px" }}>
      {isIntersecting ? (
        <ProductCard product={product} />
      ) : (
        <div className="product-card-placeholder" />
      )}
    </div>
  );
}

export default function ProductGrid({ products }) {
  if (!products || products.length === 0) {
    return (
      <div className="empty-state">
        <div className="icon">📦</div>
        <p>No products found in this category.</p>
      </div>
    );
  }

  return (
    <div className="product-grid">
      {products.map((p) => (
        <LazyProductCard key={p._id || p.sku} product={p} />
      ))}
    </div>
  );
}
