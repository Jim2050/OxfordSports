import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { resolveImageUrl, getDisplayPrice } from "../../api/api";
import { useCart } from "../../context/CartContext";
import API from "../../api/axiosInstance";

const PLACEHOLDER = "https://placehold.co/600x600/e2e8f0/64748b?text=No+Image";

export default function ProductPage() {
  const { sku } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState("");
  const [qty, setQty] = useState(1);
  const { addToCart, isInCart, openDrawer } = useCart();

  useEffect(() => {
    setLoading(true);
    setSelectedSize("");
    setQty(1);
    API.get(`/products/${encodeURIComponent(sku)}`)
      .then((r) => setProduct(r.data))
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [sku]);

  if (loading) {
    return (
      <section className="section">
        <div className="container loading-center">
          <div className="spinner" />
        </div>
      </section>
    );
  }

  if (!product) {
    return (
      <section className="section">
        <div
          className="container"
          style={{ textAlign: "center", padding: "4rem 0" }}
        >
          <h2>Product Not Found</h2>
          <p style={{ color: "#6b7280", marginBottom: "1.5rem" }}>
            The product you're looking for doesn't exist or may have been
            removed.
          </p>
          <Link to="/products" className="btn btn-primary">
            Browse All Products
          </Link>
        </div>
      </section>
    );
  }

  const img = resolveImageUrl(product.imageUrl || product.image) || PLACEHOLDER;
  const finalPrice = getDisplayPrice(product);
  const rrp = Number(product.rrp) || 0;
  const showRrp = rrp > 0 && rrp > finalPrice;
  const isUnder5 = finalPrice > 0 && finalPrice <= 5;

  // Size handling
  const sizes = Array.isArray(product.sizes) ? product.sizes : [];
  const sizeStock =
    product.sizeStock && typeof product.sizeStock === "object"
      ? product.sizeStock
      : {};
  const hasSizeStock = Object.keys(sizeStock).length > 0;
  const hasSizes = sizes.length > 0 || hasSizeStock;
  const availableSizes = hasSizeStock ? Object.keys(sizeStock) : sizes;

  // Max quantity for selected size
  const maxQty = hasSizeStock
    ? sizeStock[selectedSize] || 0
    : product.quantity || 0;

  const inCart = isInCart(product.sku, selectedSize);

  const handleAddToCart = () => {
    if (hasSizes && !selectedSize) {
      toast.error("Please select a size.");
      return;
    }
    if (hasSizeStock && maxQty > 0 && qty > maxQty) {
      toast.error(`Only ${maxQty} available in size ${selectedSize}.`);
      return;
    }
    addToCart(product, selectedSize, qty);
    toast.success(`${product.name} added to cart!`);
  };

  return (
    <>
      <section className="page-banner">
        <div className="container">
          <h1>{product.name}</h1>
          {product.category && <p>{product.category}</p>}
        </div>
      </section>

      <section className="section">
        <div className="container product-detail">
          <div className="product-detail-img">
            <img
              src={img}
              alt={product.name}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = PLACEHOLDER;
              }}
            />
          </div>
          <div className="product-detail-info">
            {product.sku && (
              <p className="sku" style={{ marginBottom: "0.5rem" }}>
                SKU: {product.sku}
              </p>
            )}
            {product.brand && (
              <p style={{ color: "#6b7280", marginBottom: "0.5rem" }}>
                Brand: <strong>{product.brand}</strong>
              </p>
            )}
            {product.color && (
              <p style={{ color: "#6b7280", marginBottom: "0.5rem" }}>
                Colour: <strong>{product.color}</strong>
              </p>
            )}
            <div
              className="price"
              style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}
            >
              £{finalPrice.toFixed(2)}
              {isUnder5 && <span className="price-under5">UNDER £5</span>}
            </div>
            {showRrp && (
              <p
                style={{
                  color: "#9ca3af",
                  marginBottom: "1rem",
                  fontSize: "0.95rem",
                }}
              >
                RRP:{" "}
                <span style={{ textDecoration: "line-through" }}>
                  £{rrp.toFixed(2)}
                </span>
              </p>
            )}
            {product.description && (
              <p style={{ marginBottom: "1.5rem", lineHeight: 1.7 }}>
                {product.description}
              </p>
            )}

            {/* ── Size selection ── */}
            {hasSizes && (
              <div style={{ marginBottom: "1.25rem" }}>
                <strong style={{ display: "block", marginBottom: "0.5rem" }}>
                  Select Size:
                </strong>
                <div className="size-selector">
                  {availableSizes.map((s) => {
                    const stock = hasSizeStock ? sizeStock[s] || 0 : null;
                    const outOfStock = hasSizeStock && stock === 0;
                    return (
                      <button
                        key={s}
                        className={`size-btn${selectedSize === s ? " selected" : ""}${outOfStock ? " disabled" : ""}`}
                        onClick={() => {
                          if (!outOfStock) {
                            setSelectedSize(s);
                            setQty(1);
                          }
                        }}
                        disabled={outOfStock}
                        title={
                          outOfStock
                            ? "Out of stock"
                            : stock !== null
                              ? `${stock} available`
                              : s
                        }
                      >
                        {s}
                        {stock !== null && (
                          <span className="size-stock">
                            {outOfStock ? "—" : stock}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Quantity selector ── */}
            <div
              style={{
                marginBottom: "1.5rem",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
              }}
            >
              <strong>Qty:</strong>
              <div className="qty-selector">
                <button
                  className="cart-qty-btn"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  disabled={qty <= 1}
                >
                  −
                </button>
                <input
                  type="number"
                  min="1"
                  max={maxQty > 0 ? maxQty : 9999}
                  value={qty}
                  onChange={(e) => {
                    const v = parseInt(e.target.value) || 1;
                    setQty(maxQty > 0 ? Math.min(v, maxQty) : Math.max(1, v));
                  }}
                  className="qty-input"
                />
                <button
                  className="cart-qty-btn"
                  onClick={() =>
                    setQty((q) =>
                      maxQty > 0 ? Math.min(q + 1, maxQty) : q + 1,
                    )
                  }
                  disabled={maxQty > 0 && qty >= maxQty}
                >
                  +
                </button>
              </div>
              {maxQty > 0 && (
                <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                  {maxQty} available
                </span>
              )}
            </div>

            {/* ── Add to cart / View cart ── */}
            {inCart ? (
              <button className="btn btn-primary btn-lg" onClick={openDrawer}>
                In Cart ✓ — View Cart
              </button>
            ) : (
              <button
                className="btn btn-accent btn-lg"
                onClick={handleAddToCart}
              >
                Add to Cart
              </button>
            )}
            <Link
              to="/products"
              className="btn btn-outline"
              style={{ marginLeft: "0.75rem" }}
            >
              Back to Products
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
