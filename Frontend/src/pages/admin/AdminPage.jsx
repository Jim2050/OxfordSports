import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import toast, { Toaster } from "react-hot-toast";
import AdminLogin from "./AdminLogin";
import { isTokenValid } from "../../api/axiosInstance";
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
  fetchAdminStats,
  fixSubcategories,
  fixBrands,
} from "../../api/api";

export default function AdminPage() {
  // Check token validity on mount (catches expired tokens before any API call)
  const savedToken = sessionStorage.getItem("adminToken");
  const [authed, setAuthed] = useState(
    !!savedToken && isTokenValid(savedToken),
  );
  // If an expired/invalid token was found, clear it immediately
  if (savedToken && !isTokenValid(savedToken)) {
    sessionStorage.removeItem("adminToken");
  }
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState(null);
  const [excelResult, setExcelResult] = useState(null);
  const [imageResult, setImageResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [serverProcessing, setServerProcessing] = useState(false);
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
    if (authed) {
      loadProducts();
      loadStats();
    }

    // Listen for 401-triggered auto-logout from the axios interceptor
    const handleLogout = () => {
      setAuthed(false);
      toast.error("Session expired — please log in again.");
    };
    window.addEventListener("admin:logout", handleLogout);
    return () => window.removeEventListener("admin:logout", handleLogout);
  }, [authed]);

  const loadStats = () => {
    fetchAdminStats()
      .then(setStats)
      .catch(() => {});
  };

  const loadProducts = () => {
    // Fetch up to 500 products for the product list table;
    // the real total count comes from the stats endpoint.
    fetchProducts({ limit: 500 })
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
    setServerProcessing(false);
    setExcelResult(null);
    try {
      const res = await uploadExcel(file, (e) => {
        if (e.total) {
          const pct = Math.round((e.loaded * 100) / e.total);
          setProgress(pct);
          if (pct >= 100) setServerProcessing(true);
        }
      });
      setExcelResult(res);
      toast.success(
        `Import complete: ${res.imported ?? 0} added, ${res.updated ?? 0} updated.`,
      );
      loadProducts();
      loadStats();
    } catch (err) {
      const msg =
        err?.response?.data?.error || "Upload failed. Check file format.";
      toast.error(msg);
    } finally {
      setUploading(false);
      setProgress(0);
      setServerProcessing(false);
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
    setServerProcessing(false);
    setImageResult(null);
    try {
      const res = await uploadImages(file, (e) => {
        if (e.total) {
          const pct = Math.round((e.loaded * 100) / e.total);
          setProgress(pct);
          if (pct >= 100) setServerProcessing(true);
        }
      });
      setImageResult(res);
      toast.success(`${res.matched ?? 0} images matched to products.`);
      loadProducts();
      loadStats();
    } catch (err) {
      const msg = err?.response?.data?.error || "Image upload failed.";
      toast.error(msg);
    } finally {
      setUploading(false);
      setProgress(0);
      setServerProcessing(false);
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
        `Are you sure you want to delete ALL ${(stats?.total ?? products.length).toLocaleString()} products? This cannot be undone.`,
      )
    )
      return;
    try {
      await deleteAllProducts();
      toast.success("All products cleared.");
      setProducts([]);
      loadStats();
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
    const sizesArr = Array.isArray(product.sizes) ? product.sizes : [];
    let sizesStr = "";
    let qtyStr = "";
    if (sizesArr.length > 0 && typeof sizesArr[0] === "object") {
      sizesStr = sizesArr.map((s) => s.size).join(", ");
      qtyStr = sizesArr
        .reduce((sum, s) => sum + (s.quantity || 0), 0)
        .toString();
    } else {
      sizesStr = sizesArr.join(", ");
      qtyStr = (product.totalQuantity || product.quantity || "").toString();
    }
    setProductForm({
      sku: product.sku || "",
      name: product.name || "",
      description: product.description || "",
      category: product.category || "",
      subcategory: product.subcategory || "",
      brand: product.brand || "",
      color: product.color || "",
      barcode: product.barcode || "",
      price: product.salePrice || product.price || "",
      rrp: product.rrp || "",
      sizes: sizesStr,
      quantity: qtyStr,
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
      loadStats();
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
        "Sale Price",
        "RRP",
        "Discount %",
        "Sizes",
        "Total Quantity",
        "Image URL",
      ];
      const csvRows = [headers.join(",")];
      rows.forEach((p) => {
        const sizesArr = Array.isArray(p.sizes) ? p.sizes : [];
        const sizesStr = sizesArr
          .map((s) =>
            typeof s === "object" ? `${s.size}(${s.quantity || 0})` : s,
          )
          .join("; ");
        const salePrice = Number(p.salePrice || p.price) || 0;
        const rrpVal = Number(p.rrp) || 0;
        const discPct =
          p.discountPercentage ||
          (rrpVal > 0 && salePrice < rrpVal
            ? Math.round(((rrpVal - salePrice) / rrpVal) * 100)
            : 0);
        const totalQty = p.totalQuantity || p.quantity || 0;
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
            salePrice,
            rrpVal,
            discPct,
            `"${sizesStr.replace(/"/g, '""')}"`,
            totalQty,
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
            {/* Use the stats endpoint total — not products.length which is capped at 500 */}
            <div className="number">{stats?.total ?? products.length}</div>
            <div className="label">Total Products</div>
          </div>
          <div className="stat-card">
            <div className="number">
              {stats?.underFive ??
                products.filter((p) => Number(p.salePrice || p.price) <= 5)
                  .length}
            </div>
            <div className="label">Under £5</div>
          </div>
          <div className="stat-card">
            <div className="number">
              {stats?.withImages ??
                products.filter((p) => p.imageUrl || p.image).length}
            </div>
            <div className="label">With Images</div>
          </div>
          <div className="stat-card">
            <div className="number">
              {stats?.categoryCount ??
                new Set(products.map((p) => p.category).filter(Boolean)).size}
            </div>
            <div className="label">Categories</div>
          </div>
          <div className="stat-card">
            <div className="number">{stats?.brandCount ?? "—"}</div>
            <div className="label">Brands</div>
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

        {/* Utility tools — collapsed by default */}
        <details className="admin-utilities" style={{ marginBottom: "1.5rem" }}>
          <summary style={{ cursor: "pointer", fontSize: "0.85rem", color: "#6b7280", fontWeight: 600 }}>
            🔧 Utility Tools
          </summary>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
            <button
              className="btn btn-sm btn-outline"
              title="Set brand = adidas on all products with empty brand"
              onClick={async () => {
                if (
                  !window.confirm(
                    'Set brand to "adidas" on all products with an empty brand field?',
                  )
                )
                  return;
                try {
                  const r = await fixBrands();
                  toast.success(r.message || `Fixed ${r.updated} products.`);
                  loadStats();
                } catch {
                  toast.error("Brand fix failed.");
                }
              }}
            >
              🏷️ Fix Brands
            </button>
            <button
              className="btn btn-sm btn-outline"
              title="One-time migration: auto-detect Rugby/Football/Footwear subcategories from product names"
              onClick={async () => {
                if (
                  !window.confirm(
                    "Scan all products and auto-assign subcategories (Rugby / Football / Footwear) from product names? Safe to run multiple times.",
                  )
                )
                  return;
                try {
                  const r = await fixSubcategories();
                  toast.success(r.message || `Fixed ${r.updated} products.`);
                  loadStats();
                } catch {
                  toast.error("Subcategory fix failed.");
                }
              }}
            >
              🔧 Fix Subcategories
            </button>
          </div>
        </details>

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
              className={`dropzone${excelZone.isDragActive ? " active" : ""}${uploading ? " disabled" : ""}`}
            >
              <input {...excelZone.getInputProps()} />
              <div className="icon">📄</div>
              <p>
                {serverProcessing
                  ? "⏳ Processing on server — parsing sheets, consolidating SKUs…"
                  : uploading
                    ? `Uploading… ${progress}%`
                    : "Drop your Excel file here, or click to browse"}
              </p>
              <span className="dropzone-hint">
                Supports .xlsx, .xls, .csv — up to 50 MB
              </span>
            </div>

            {uploading && (
              <div className="progress-wrap">
                <div className="progress-bar">
                  <div
                    className={`progress-bar-fill${serverProcessing ? " pulsing" : ""}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="progress-text">
                  {serverProcessing ? "Processing…" : `${progress}%`}
                </span>
              </div>
            )}

            {excelResult && (
              <div
                className={`import-result ${excelResult.failed > 0 ? "warning" : "success"}`}
              >
                <strong>Import Summary</strong>
                <div className="import-stats">
                  <span className="stat-green">
                    ✅ {excelResult.imported ?? 0} SKUs imported
                  </span>
                  <span className="stat-blue">
                    🔄 {excelResult.updated ?? 0} SKUs updated
                  </span>
                  <span className="stat-red">
                    ❌ {excelResult.failed ?? 0} failed
                  </span>
                  <span className="stat-total">
                    📊 {excelResult.totalRawRows ?? excelResult.total ?? 0} raw
                    rows → {excelResult.consolidatedProducts ?? "?"} unique SKUs
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
              Name each file with the product SKU — e.g. <code>GK5757.jpg</code>, <code>FY6503.png</code>.
              The system matches filenames to existing products automatically (case-insensitive).
            </p>

            <div
              {...imageZone.getRootProps()}
              className={`dropzone${imageZone.isDragActive ? " active" : ""}${uploading ? " disabled" : ""}`}
            >
              <input {...imageZone.getInputProps()} />
              <div className="icon">🖼️</div>
              <p>
                {serverProcessing
                  ? "⏳ Matching images to products & uploading to cloud…"
                  : uploading
                    ? `Uploading… ${progress}%`
                    : "Drop your .zip image archive here, or click to browse"}
              </p>
              <span className="dropzone-hint">
                Supports .jpg, .png, .webp inside a .zip file — up to 100 MB
              </span>
            </div>

            {uploading && (
              <div className="progress-wrap">
                <div className="progress-bar">
                  <div
                    className={`progress-bar-fill${serverProcessing ? " pulsing" : ""}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="progress-text">
                  {serverProcessing ? "Processing…" : `${progress}%`}
                </span>
              </div>
            )}

            {imageResult && (
              <div className={`import-result ${imageResult.errors?.length > 0 ? "warning" : "success"}`}>
                <strong>Image Upload Summary</strong>
                <div className="import-stats">
                  <span className="stat-green">
                    ✅ {imageResult.matched ?? 0} matched & uploaded
                  </span>
                  <span className="stat-red">
                    ❓ {imageResult.unmatched ?? 0} unmatched (no product with that SKU)
                  </span>
                  {imageResult.errors?.length > 0 && (
                    <span className="stat-red">
                      ❌ {imageResult.errors.length} upload error(s)
                    </span>
                  )}
                </div>
                {imageResult.unmatchedFiles &&
                  imageResult.unmatchedFiles.length > 0 && (
                    <details style={{ marginTop: "0.75rem" }}>
                      <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                        View {imageResult.unmatchedFiles.length} unmatched file(s) — no matching SKU found in database
                      </summary>
                      <ul style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
                        {imageResult.unmatchedFiles.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                {imageResult.errors?.length > 0 && (
                  <details style={{ marginTop: "0.5rem" }}>
                    <summary
                      style={{ cursor: "pointer", fontWeight: 600, color: "#991b1b" }}
                    >
                      View {imageResult.errors.length} error(s) — images matched but failed to save
                    </summary>
                    <ul style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
                      {imageResult.errors.map((e, i) => (
                        <li key={i} style={{ color: "#991b1b" }}>{e}</li>
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
                <label>Sale Price (£) *</label>
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
              <h3>
                Product List — showing {products.length}
                {stats?.total && stats.total > products.length
                  ? ` of ${stats.total.toLocaleString()}`
                  : ""}
              </h3>
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
                      <th>Sale £</th>
                      <th>RRP</th>
                      <th>Discount</th>
                      <th>Sizes (Qty)</th>
                      <th>Total Qty</th>
                      <th style={{ width: 60, textAlign: "center" }}>Delete</th>
                      <th style={{ width: 60, textAlign: "center" }}>Edit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.slice(0, 500).map((p, i) => {
                      const salePrice = Number(p.salePrice || p.price) || 0;
                      const rrpVal = Number(p.rrp) || 0;
                      const discPct =
                        p.discountPercentage ||
                        (rrpVal > 0 && salePrice < rrpVal
                          ? Math.round(((rrpVal - salePrice) / rrpVal) * 100)
                          : 0);
                      const sizesArr = Array.isArray(p.sizes) ? p.sizes : [];
                      const totalQty =
                        p.totalQuantity ||
                        p.quantity ||
                        sizesArr.reduce(
                          (s, e) =>
                            s + (typeof e === "object" ? e.quantity || 0 : 0),
                          0,
                        );
                      const sizesDisplay = sizesArr
                        .map((s) =>
                          typeof s === "object"
                            ? `${s.size}(${s.quantity || 0})`
                            : s,
                        )
                        .join(", ");

                      return (
                        <tr key={p._id || p.sku}>
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
                          <td>£{salePrice.toFixed(2)}</td>
                          <td>{rrpVal ? `£${rrpVal.toFixed(2)}` : "—"}</td>
                          <td>
                            {discPct > 0 ? (
                              <span
                                style={{ color: "#dc2626", fontWeight: 600 }}
                              >
                                {discPct}%
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td
                            style={{
                              fontSize: "0.78rem",
                              maxWidth: 180,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={sizesDisplay}
                          >
                            {sizesDisplay || "—"}
                          </td>
                          <td style={{ fontWeight: 600, textAlign: "center" }}>
                            {totalQty}
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
                      );
                    })}
                  </tbody>
                </table>
                {filteredProducts.length > 500 && (
                  <p className="admin-hint" style={{ marginTop: "0.75rem" }}>
                    Showing first 500 of {filteredProducts.length} products
                    {searchQuery && " (filtered)"}. Use search to narrow
                    results.
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
