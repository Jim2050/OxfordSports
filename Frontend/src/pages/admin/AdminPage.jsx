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
  addProduct,
  updateProduct,
  exportProducts,
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
  const [editingSku, setEditingSku] = useState(null);
  const [productForm, setProductForm] = useState({
    sku: "",
    name: "",
    description: "",
    category: "",
    subcategory: "",
    brand: "",
    color: "",
    barcode: "",
    price: "",
    rrp: "",
    sizes: "",
    quantity: "",
  });
  const [formLoading, setFormLoading] = useState(false);

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

  /* ── Add / Edit product form ── */
  const resetForm = () => {
    setProductForm({
      sku: "",
      name: "",
      description: "",
      category: "",
      subcategory: "",
      brand: "",
      color: "",
      barcode: "",
      price: "",
      rrp: "",
      sizes: "",
      quantity: "",
    });
    setEditingSku(null);
  };

  const startEdit = (product) => {
    setProductForm({
      sku: product.sku || "",
      name: product.name || "",
      description: product.description || "",
      category: product.category || "",
      subcategory: product.subcategory || "",
      brand: product.brand || "",
      color: product.color || "",
      barcode: product.barcode || "",
      price: product.price || "",
      rrp: product.rrp || "",
      sizes: Array.isArray(product.sizes)
        ? product.sizes.join(", ")
        : product.sizes || "",
      quantity: product.quantity || "",
    });
    setEditingSku(product.sku);
    setTab("addproduct");
  };

  const handleFormChange = (e) =>
    setProductForm({ ...productForm, [e.target.name]: e.target.value });

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!productForm.name) {
      toast.error("Product name is required.");
      return;
    }
    if (!productForm.price) {
      toast.error("Price is required.");
      return;
    }

    setFormLoading(true);
    try {
      if (editingSku) {
        await updateProduct(editingSku, productForm);
        toast.success("Product updated.");
      } else {
        await addProduct(productForm);
        toast.success("Product added.");
      }
      resetForm();
      loadProducts();
      setTab("products");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to save product.");
    } finally {
      setFormLoading(false);
    }
  };

  /* ── Export products as CSV ── */
  const handleExport = async () => {
    try {
      const data = await exportProducts();
      const rows = data.products || [];
      if (rows.length === 0) {
        toast.error("No products to export.");
        return;
      }

      const headers = [
        "SKU",
        "Name",
        "Description",
        "Category",
        "Subcategory",
        "Brand",
        "Color",
        "Barcode",
        "Trade Price",
        "RRP",
        "Sizes",
        "Quantity",
        "Image URL",
      ];
      const csvRows = [headers.join(",")];
      rows.forEach((p) => {
        const sizesStr = Array.isArray(p.sizes)
          ? p.sizes.join("; ")
          : p.sizes || "";
        csvRows.push(
          [
            `"${(p.sku || "").replace(/"/g, '""')}"`,
            `"${(p.name || "").replace(/"/g, '""')}"`,
            `"${(p.description || "").replace(/"/g, '""')}"`,
            `"${(p.category || "").replace(/"/g, '""')}"`,
            `"${(p.subcategory || "").replace(/"/g, '""')}"`,
            `"${(p.brand || "").replace(/"/g, '""')}"`,
            `"${(p.color || "").replace(/"/g, '""')}"`,
            `"${(p.barcode || "").replace(/"/g, '""')}"`,
            p.price || "",
            p.rrp || "",
            `"${sizesStr.replace(/"/g, '""')}"`,
            p.quantity || "",
            `"${(p.imageUrl || "").replace(/"/g, '""')}"`,
          ].join(","),
        );
      });

      const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `oxford-sports-products-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} products.`);
    } catch {
      toast.error("Export failed.");
    }
  };

  /* ── Filter products for table ── */
  const filteredProducts = searchQuery
    ? products.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.sku || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.category || "")
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          (p.color || "").toLowerCase().includes(searchQuery.toLowerCase()),
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
            {
              key: "addproduct",
              icon: "➕",
              label: editingSku ? "Edit Product" : "Add Product",
            },
            { key: "products", icon: "📋", label: "Product List" },
          ].map((t) => (
            <button
              key={t.key}
              className={`btn btn-sm ${tab === t.key ? "btn-primary" : "btn-outline"}`}
              onClick={() => {
                setTab(t.key);
                if (t.key === "addproduct" && !editingSku) resetForm();
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
          {products.length > 0 && (
            <button className="btn btn-sm btn-outline" onClick={handleExport}>
              📥 Export CSV
            </button>
          )}
        </div>

        {/* ── Excel Tab ── */}
        {tab === "excel" && (
          <div className="admin-card">
            <h3>Upload Product Excel</h3>
            <p className="admin-hint">
              Drag and drop your <strong>.xlsx</strong> file. The system reads
              <strong> all sheets</strong> (Master, FIREBIRD, etc.) and
              auto-detects columns: Code, Gender, Style, Colour Desc, UK Size,
              Barcode, RRP, Trade. Same-SKU rows with different sizes are merged
              automatically.
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
                    📊 {excelResult.totalRawRows ?? excelResult.total ?? 0} raw
                    rows → {excelResult.consolidatedProducts ?? "?"} products
                  </span>
                  {excelResult.executionTime && (
                    <span className="stat-total">
                      ⏱️ {excelResult.executionTime}
                    </span>
                  )}
                </div>

                {excelResult.sheetSummary &&
                  excelResult.sheetSummary.length > 0 && (
                    <details style={{ marginTop: "0.75rem" }}>
                      <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                        Sheet breakdown ({excelResult.sheetSummary.length}{" "}
                        sheets)
                      </summary>
                      <ul className="mapping-list">
                        {excelResult.sheetSummary.map((s, i) => (
                          <li key={i}>
                            <strong>{s.name}</strong>: {s.rows} rows
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                {excelResult.categoriesCreated &&
                  excelResult.categoriesCreated.length > 0 && (
                    <div
                      style={{
                        marginTop: "0.5rem",
                        fontSize: "0.85rem",
                        color: "#059669",
                      }}
                    >
                      📁 Categories auto-created:{" "}
                      {excelResult.categoriesCreated.join(", ")}
                    </div>
                  )}

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

        {/* ── Add/Edit Product Tab ── */}
        {tab === "addproduct" && (
          <div className="admin-card">
            <h3>
              {editingSku ? `Edit Product: ${editingSku}` : "Add New Product"}
            </h3>
            <form
              onSubmit={handleFormSubmit}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
                marginTop: "1rem",
              }}
            >
              <div className="form-field">
                <label>SKU</label>
                <input
                  name="sku"
                  value={productForm.sku}
                  onChange={handleFormChange}
                  placeholder="e.g. ADI-RM-001"
                  disabled={!!editingSku}
                />
              </div>
              <div className="form-field">
                <label>Product Name *</label>
                <input
                  name="name"
                  value={productForm.name}
                  onChange={handleFormChange}
                  placeholder="Product name"
                  required
                />
              </div>
              <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                <label>Description</label>
                <textarea
                  name="description"
                  value={productForm.description}
                  onChange={handleFormChange}
                  placeholder="Product description"
                  rows={3}
                />
              </div>
              <div className="form-field">
                <label>Category</label>
                <input
                  name="category"
                  value={productForm.category}
                  onChange={handleFormChange}
                  placeholder="e.g. Football"
                />
              </div>
              <div className="form-field">
                <label>Subcategory</label>
                <input
                  name="subcategory"
                  value={productForm.subcategory}
                  onChange={handleFormChange}
                  placeholder="e.g. Real Madrid"
                />
              </div>
              <div className="form-field">
                <label>Brand</label>
                <input
                  name="brand"
                  value={productForm.brand}
                  onChange={handleFormChange}
                  placeholder="e.g. adidas"
                />
              </div>
              <div className="form-field">
                <label>Color</label>
                <input
                  name="color"
                  value={productForm.color}
                  onChange={handleFormChange}
                  placeholder="e.g. Black/White"
                />
              </div>
              <div className="form-field">
                <label>Barcode</label>
                <input
                  name="barcode"
                  value={productForm.barcode}
                  onChange={handleFormChange}
                  placeholder="EAN/UPC"
                />
              </div>
              <div className="form-field">
                <label>Trade Price (£) *</label>
                <input
                  name="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={productForm.price}
                  onChange={handleFormChange}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="form-field">
                <label>RRP (£)</label>
                <input
                  name="rrp"
                  type="number"
                  step="0.01"
                  min="0"
                  value={productForm.rrp}
                  onChange={handleFormChange}
                  placeholder="0.00"
                />
              </div>
              <div className="form-field">
                <label>Sizes</label>
                <input
                  name="sizes"
                  value={productForm.sizes}
                  onChange={handleFormChange}
                  placeholder="S, M, L, XL"
                />
              </div>
              <div className="form-field">
                <label>Quantity</label>
                <input
                  name="quantity"
                  value={productForm.quantity}
                  onChange={handleFormChange}
                  placeholder="e.g. 100"
                />
              </div>
              <div
                style={{
                  gridColumn: "1 / -1",
                  display: "flex",
                  gap: "1rem",
                  marginTop: "0.5rem",
                }}
              >
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={formLoading}
                >
                  {formLoading
                    ? "Saving…"
                    : editingSku
                      ? "Update Product"
                      : "Add Product"}
                </button>
                {editingSku && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      resetForm();
                      setTab("products");
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
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
                      <th>Color</th>
                      <th>Trade</th>
                      <th>RRP</th>
                      <th>Sizes</th>
                      <th style={{ width: 60, textAlign: "center" }}>Delete</th>
                      <th style={{ width: 60, textAlign: "center" }}>Edit</th>
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
                        <td>{p.color || "—"}</td>
                        <td>£{Number(p.price).toFixed(2)}</td>
                        <td>{p.rrp ? `£${Number(p.rrp).toFixed(2)}` : "—"}</td>
                        <td style={{ fontSize: "0.8rem" }}>
                          {Array.isArray(p.sizes)
                            ? p.sizes.join(", ")
                            : p.sizes || "—"}
                        </td>
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
                        <td style={{ textAlign: "center" }}>
                          <button
                            onClick={() => startEdit(p)}
                            title="Edit product"
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "1.1rem",
                              color: "#1a1281",
                              padding: "0.25rem",
                            }}
                          >
                            ✏️
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
