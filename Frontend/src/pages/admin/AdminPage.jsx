import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import toast, { Toaster } from "react-hot-toast";
import AdminLogin from "./AdminLogin";
import {
  uploadExcel,
  uploadImages,
  fetchProducts,
  deleteProduct,
  deleteAllProducts,
  resolveImageUrl,
} from "../../api/api";

export default function AdminPage() {
  const [authed, setAuthed] = useState(!!sessionStorage.getItem("adminToken"));
  const [products, setProducts] = useState([]);
  const [excelResult, setExcelResult] = useState(null);
  const [imageResult, setImageResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tab, setTab] = useState("excel");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (authed) loadProducts();
  }, [authed]);

  const loadProducts = () => {
    fetchProducts()
      .then((data) =>
        setProducts(Array.isArray(data) ? data : data.products || []),
      )
      .catch(() => {});
  };

  /* ── Excel Dropzone ── */
  const onDropExcel = useCallback(async (accepted) => {
    const file = accepted[0];
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext)) {
      toast.error("Please upload an .xlsx, .xls, or .csv file.");
      return;
    }
    setUploading(true);
    setProgress(0);
    setExcelResult(null);
    try {
      const res = await uploadExcel(file, (e) => {
        if (e.total) setProgress(Math.round((e.loaded * 100) / e.total));
      });
      setExcelResult(res);
      toast.success(
        `Import complete: ${res.imported ?? 0} added, ${res.updated ?? 0} updated.`,
      );
      loadProducts();
    } catch (err) {
      const msg =
        err?.response?.data?.error || "Upload failed. Check file format.";
      toast.error(msg);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }, []);

  const excelZone = useDropzone({
    onDrop: onDropExcel,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
    },
    multiple: false,
    disabled: uploading,
  });

  /* ── Image ZIP Dropzone ── */
  const onDropImages = useCallback(async (accepted) => {
    const file = accepted[0];
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setImageResult(null);
    try {
      const res = await uploadImages(file, (e) => {
        if (e.total) setProgress(Math.round((e.loaded * 100) / e.total));
      });
      setImageResult(res);
      toast.success(`${res.matched ?? 0} images matched to products.`);
      loadProducts();
    } catch (err) {
      const msg = err?.response?.data?.error || "Image upload failed.";
      toast.error(msg);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }, []);

  const imageZone = useDropzone({
    onDrop: onDropImages,
    accept: {
      "application/zip": [".zip"],
      "application/x-zip-compressed": [".zip"],
    },
    multiple: false,
    disabled: uploading,
  });

  /* ── Delete single product ── */
  const handleDelete = async (sku) => {
    if (!window.confirm(`Delete product ${sku}?`)) return;
    try {
      await deleteProduct(sku);
      toast.success("Product deleted.");
      loadProducts();
    } catch {
      toast.error("Failed to delete product.");
    }
  };

  /* ── Clear all products ── */
  const handleClearAll = async () => {
    if (
      !window.confirm(
        `Are you sure you want to delete ALL ${products.length} products? This cannot be undone.`,
      )
    )
      return;
    try {
      await deleteAllProducts();
      toast.success("All products cleared.");
      setProducts([]);
    } catch {
      toast.error("Failed to clear products.");
    }
  };

  /* ── Filter products for table ── */
  const filteredProducts = searchQuery
    ? products.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.sku || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.category || "").toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : products;

  /* ── Auth gate ── */
  if (!authed) return <AdminLogin onAuth={setAuthed} />;

  return (
    <div className="admin-layout">
      <Toaster position="top-right" />

      <div className="admin-header">
        <h2>Oxford Sports — Admin</h2>
        <button
          className="btn btn-sm btn-outline"
          style={{ borderColor: "#fff", color: "#fff" }}
          onClick={() => {
            sessionStorage.removeItem("adminToken");
            setAuthed(false);
          }}
        >
          Logout
        </button>
      </div>

      <div className="admin-content">
        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="number">{products.length}</div>
            <div className="label">Total Products</div>
          </div>
          <div className="stat-card">
            <div className="number">
              {products.filter((p) => Number(p.price) <= 5).length}
            </div>
            <div className="label">Under £5</div>
          </div>
          <div className="stat-card">
            <div className="number">
              {products.filter((p) => p.imageUrl || p.image).length}
            </div>
            <div className="label">With Images</div>
          </div>
          <div className="stat-card">
            <div className="number">
              {new Set(products.map((p) => p.category).filter(Boolean)).size}
            </div>
            <div className="label">Categories</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="admin-tabs">
          {[
            { key: "excel", icon: "📄", label: "Upload Excel" },
            { key: "images", icon: "🖼️", label: "Upload Images" },
            { key: "products", icon: "📋", label: "Product List" },
          ].map((t) => (
            <button
              key={t.key}
              className={`btn btn-sm ${tab === t.key ? "btn-primary" : "btn-outline"}`}
              onClick={() => setTab(t.key)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── Excel Tab ── */}
        {tab === "excel" && (
          <div className="admin-card">
            <h3>Upload Product Excel</h3>
            <p className="admin-hint">
              Drag and drop your <strong>.xlsx</strong> file. The system smartly
              auto-detects columns like SKU, Product Name, Price, Category, etc.
              — works with Adidas, Puma, and generic price lists.
            </p>

            <div
              {...excelZone.getRootProps()}
              className={`dropzone${excelZone.isDragActive ? " active" : ""}`}
            >
              <input {...excelZone.getInputProps()} />
              <div className="icon">📄</div>
              <p>
                {uploading
                  ? "Uploading…"
                  : "Drop your Excel file here, or click to browse"}
              </p>
              <span className="dropzone-hint">
                Supports .xlsx, .xls, .csv — up to 50MB
              </span>
            </div>

            {uploading && (
              <div className="progress-bar">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            {excelResult && (
              <div
                className={`import-result ${excelResult.failed > 0 ? "warning" : "success"}`}
              >
                <strong>Import Summary</strong>
                <div className="import-stats">
                  <span className="stat-green">
                    ✅ {excelResult.imported ?? 0} imported
                  </span>
                  <span className="stat-blue">
                    🔄 {excelResult.updated ?? 0} updated
                  </span>
                  <span className="stat-red">
                    ❌ {excelResult.failed ?? 0} failed
                  </span>
                  <span className="stat-total">
                    📊 {excelResult.total ?? 0} total rows
                  </span>
                </div>

                {excelResult.mapping && (
                  <details style={{ marginTop: "0.75rem" }}>
                    <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                      Column mapping used
                    </summary>
                    <ul className="mapping-list">
                      {Object.entries(excelResult.mapping).map(
                        ([field, col]) => (
                          <li key={field}>
                            <strong>{field}</strong> → {col}
                          </li>
                        ),
                      )}
                    </ul>
                  </details>
                )}

                {excelResult.errors && excelResult.errors.length > 0 && (
                  <details style={{ marginTop: "0.5rem" }}>
                    <summary
                      style={{
                        cursor: "pointer",
                        fontWeight: 600,
                        color: "#991b1b",
                      }}
                    >
                      View {excelResult.errors.length} error(s)
                    </summary>
                    <ul style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
                      {excelResult.errors.map((e, i) => (
                        <li key={i}>
                          Row {e.row}: {e.reason}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Images Tab ── */}
        {tab === "images" && (
          <div className="admin-card">
            <h3>Bulk Image Upload (ZIP)</h3>
            <p className="admin-hint">
              Upload a <strong>.zip</strong> file containing product images.
              Filenames must match the SKU (e.g., <code>ADI-RM-001.jpg</code>).
              Images are auto-matched to existing products.
            </p>

            <div
              {...imageZone.getRootProps()}
              className={`dropzone${imageZone.isDragActive ? " active" : ""}`}
            >
              <input {...imageZone.getInputProps()} />
              <div className="icon">🖼️</div>
              <p>
                {uploading
                  ? "Processing images…"
                  : "Drop your .zip image archive here, or click to browse"}
              </p>
              <span className="dropzone-hint">
                Supports .jpg, .png, .webp inside a .zip file
              </span>
            </div>

            {uploading && (
              <div className="progress-bar">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            {imageResult && (
              <div className="import-result success">
                <strong>Image Match Summary</strong>
                <div className="import-stats">
                  <span className="stat-green">
                    ✅ {imageResult.matched ?? 0} matched
                  </span>
                  <span className="stat-red">
                    ❓ {imageResult.unmatched ?? 0} unmatched
                  </span>
                </div>
                {imageResult.unmatchedFiles &&
                  imageResult.unmatchedFiles.length > 0 && (
                    <details style={{ marginTop: "0.75rem" }}>
                      <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                        View unmatched files
                      </summary>
                      <ul style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
                        {imageResult.unmatchedFiles.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </details>
                  )}
              </div>
            )}
          </div>
        )}

        {/* ── Products Tab ── */}
        {tab === "products" && (
          <div className="admin-card">
            <div className="admin-card-header">
              <h3>Product List ({products.length})</h3>
              {products.length > 0 && (
                <button
                  className="btn btn-sm"
                  style={{
                    background: "#dc2626",
                    color: "#fff",
                    fontSize: "0.8rem",
                  }}
                  onClick={handleClearAll}
                >
                  🗑️ Clear All
                </button>
              )}
            </div>

            {/* Search within products */}
            {products.length > 0 && (
              <div style={{ marginBottom: "1rem" }}>
                <input
                  type="text"
                  placeholder="Search by name, SKU, or category…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.55rem 0.75rem",
                    border: "1.5px solid #e5e7eb",
                    borderRadius: "6px",
                    fontSize: "0.9rem",
                    outline: "none",
                  }}
                />
              </div>
            )}

            {products.length === 0 ? (
              <p className="admin-hint">
                No products yet. Upload an Excel file to get started.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>SKU</th>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Sizes</th>
                      <th style={{ width: 60, textAlign: "center" }}>Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.slice(0, 200).map((p, i) => (
                      <tr key={p.sku || i}>
                        <td>
                          {p.imageUrl || p.image ? (
                            <img
                              src={resolveImageUrl(p.imageUrl || p.image)}
                              alt=""
                              style={{
                                width: 48,
                                height: 48,
                                objectFit: "cover",
                                borderRadius: 4,
                              }}
                            />
                          ) : (
                            <span style={{ color: "#9ca3af" }}>—</span>
                          )}
                        </td>
                        <td>
                          <code style={{ fontSize: "0.8rem" }}>
                            {p.sku || "—"}
                          </code>
                        </td>
                        <td>{p.name}</td>
                        <td>{p.category || "—"}</td>
                        <td>£{Number(p.price).toFixed(2)}</td>
                        <td>{p.sizes || "—"}</td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            onClick={() => handleDelete(p.sku)}
                            title="Delete product"
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "1.1rem",
                              color: "#dc2626",
                              padding: "0.25rem",
                            }}
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredProducts.length > 200 && (
                  <p className="admin-hint" style={{ marginTop: "0.75rem" }}>
                    Showing first 200 of {filteredProducts.length} products
                    {searchQuery && " (filtered)"}.
                  </p>
                )}
                {searchQuery && filteredProducts.length === 0 && (
                  <p className="admin-hint" style={{ marginTop: "0.75rem" }}>
                    No products match "{searchQuery}".
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
