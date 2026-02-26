import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import toast, { Toaster } from "react-hot-toast";
import AdminLogin from "./AdminLogin";
import { uploadExcel, uploadImages, fetchProducts } from "../../api/api";

export default function AdminPage() {
  const [authed, setAuthed] = useState(!!sessionStorage.getItem("adminToken"));
  const [products, setProducts] = useState([]);
  const [excelResult, setExcelResult] = useState(null);
  const [imageResult, setImageResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tab, setTab] = useState("excel");

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
        `Import complete: ${res.imported ?? 0} products added, ${res.updated ?? 0} updated.`,
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
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
          <button
            className={`btn btn-sm ${tab === "excel" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setTab("excel")}
          >
            📄 Upload Excel
          </button>
          <button
            className={`btn btn-sm ${tab === "images" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setTab("images")}
          >
            🖼️ Upload Images
          </button>
          <button
            className={`btn btn-sm ${tab === "products" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setTab("products")}
          >
            📋 Product List
          </button>
        </div>

        {/* ── Excel Tab ── */}
        {tab === "excel" && (
          <div className="admin-card">
            <h3>Upload Product Excel</h3>
            <p
              style={{
                color: "#6b7280",
                fontSize: "0.9rem",
                marginBottom: "1rem",
              }}
            >
              Drag and drop your .xlsx file. The system will auto-detect columns
              like SKU, Product Name, Price, Category, etc.
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
                className={`import-result ${excelResult.failed > 0 ? "error" : "success"}`}
              >
                <strong>Import Summary:</strong>
                <br />✅ Imported: {excelResult.imported ?? 0} | 🔄 Updated:{" "}
                {excelResult.updated ?? 0} | ❌ Failed:{" "}
                {excelResult.failed ?? 0} | Total rows: {excelResult.total ?? 0}
                {excelResult.errors && excelResult.errors.length > 0 && (
                  <details style={{ marginTop: "0.75rem" }}>
                    <summary style={{ cursor: "pointer", fontWeight: 600 }}>
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
            <p
              style={{
                color: "#6b7280",
                fontSize: "0.9rem",
                marginBottom: "1rem",
              }}
            >
              Upload a .zip file containing product images. Filenames must match
              the SKU (e.g., <code>ADI-RM-001.jpg</code>). Images auto-match to
              existing products.
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
                <strong>Image Match Summary:</strong>
                <br />✅ Matched: {imageResult.matched ?? 0} | ❓ Unmatched:{" "}
                {imageResult.unmatched ?? 0}
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
            <h3>Product List ({products.length})</h3>
            {products.length === 0 ? (
              <p style={{ color: "#6b7280" }}>
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
                    </tr>
                  </thead>
                  <tbody>
                    {products.slice(0, 200).map((p, i) => (
                      <tr key={p.sku || i}>
                        <td>
                          {p.imageUrl || p.image ? (
                            <img
                              src={p.imageUrl || p.image}
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
                        <td>{p.sku || "—"}</td>
                        <td>{p.name}</td>
                        <td>{p.category || "—"}</td>
                        <td>£{Number(p.price).toFixed(2)}</td>
                        <td>{p.sizes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {products.length > 200 && (
                  <p
                    style={{
                      color: "#6b7280",
                      fontSize: "0.85rem",
                      marginTop: "0.75rem",
                    }}
                  >
                    Showing first 200 of {products.length} products.
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
