import ProductCard from "./ProductCard";

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
        <ProductCard key={p._id || p.sku} product={p} />
      ))}
    </div>
  );
}
