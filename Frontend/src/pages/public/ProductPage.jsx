import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { buildMailto } from "../../utils/buildMailto";
import { resolveImageUrl } from "../../api/api";
import API from "../../api/axiosInstance";

const PLACEHOLDER = "https://placehold.co/600x600/e2e8f0/64748b?text=No+Image";

export default function ProductPage() {
  const { sku } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
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
  const isUnder5 = Number(product.price) <= 5;

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
              £{Number(product.price).toFixed(2)}
              {isUnder5 && <span className="price-under5">UNDER £5</span>}
            </div>
            {product.rrp > 0 && (
              <p
                style={{
                  color: "#6b7280",
                  marginBottom: "1rem",
                  fontSize: "0.95rem",
                }}
              >
                RRP: £{Number(product.rrp).toFixed(2)}
              </p>
            )}
            {product.description && (
              <p style={{ marginBottom: "1.5rem", lineHeight: 1.7 }}>
                {product.description}
              </p>
            )}
            {product.sizes &&
              (Array.isArray(product.sizes)
                ? product.sizes.length > 0
                : product.sizes) && (
                <p style={{ marginBottom: "1.5rem" }}>
                  <strong>Sizes:</strong>{" "}
                  {Array.isArray(product.sizes)
                    ? product.sizes.join(", ")
                    : product.sizes}
                </p>
              )}
            <a href={buildMailto(product)} className="btn btn-accent btn-lg">
              Order by Email
            </a>
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
