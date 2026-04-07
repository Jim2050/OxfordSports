import { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import toast, { Toaster } from "react-hot-toast";
import AdminLogin from "./AdminLogin";
import { isTokenValid } from "../../api/axiosInstance";
import {
  uploadExcel,
  uploadImages,
  getImageUploadStatus,
  deleteProduct,
  deleteAllProducts,
  resolveImageUrl,
  addProduct,
  updateProduct,
  exportProducts,
  fetchAdminStats,
  fetchAdminProducts,
  fixSubcategories,
  fixBrands,
  uploadProductImage,
  bulkRecategorize,
  fetchCategories,
  fetchDeletedBatches,
  fetchImportBatches,
  restoreProducts,
  getSizes,
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
  const [stockFilter, setStockFilter] = useState("all");
  const [sizeFilter, setSizeFilter] = useState("all");
  const [manualFilter, setManualFilter] = useState("all");
  const [productPage, setProductPage] = useState(1);
  const [productPages, setProductPages] = useState(1);
  const [productTotal, setProductTotal] = useState(0);
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
  const [productImageFile, setProductImageFile] = useState(null);
  const [productImagePreview, setProductImagePreview] = useState(null);
  const [categoryList, setCategoryList] = useState([]);
  const [subcategoryList, setSubcategoryList] = useState([]);
  const [importBatches, setImportBatches] = useState([]);
  const PRODUCT_PAGE_SIZE = 100;
  
  // Debounce stats loading to prevent excessive API calls (store last load time)
  const lastStatsLoadRef = useRef(0);
  const statsLoadTimer = useRef(null);
  
  const debouncedLoadStats = useCallback(() => {
    // Clear any pending timer
    if (statsLoadTimer.current) clearTimeout(statsLoadTimer.current);
    
    // Only load if more than 3 seconds since last load
    const now = Date.now();
    if (now - lastStatsLoadRef.current >= 3000) {
      lastStatsLoadRef.current = now;
      loadStats();
    } else {
      // Schedule for later
      const delay = 3000 - (now - lastStatsLoadRef.current);
      statsLoadTimer.current = setTimeout(() => {
        lastStatsLoadRef.current = Date.now();
        loadStats();
      }, delay);
    }
  }, []);

  useEffect(() => {
    if (authed) {
      loadStats();
      loadCategories();
      loadImportBatches();
    }

    // Listen for 401-triggered auto-logout from the axios interceptor
    const handleLogout = () => {
      setAuthed(false);
      toast.error("Session expired — please log in again.");
    };
    window.addEventListener("admin:logout", handleLogout);
    return () => window.removeEventListener("admin:logout", handleLogout);
  }, [authed]);

  useEffect(() => {
    if (!authed || tab !== "products") return;
    const timer = setTimeout(() => {
      loadProducts({ page: productPage, search: searchQuery });
    }, 220);
    return () => clearTimeout(timer);
  }, [authed, tab, productPage, searchQuery, stockFilter, sizeFilter, manualFilter]);

  const loadStats = () => {
    fetchAdminStats()
      .then(setStats)
      .catch(() => {});
  };

  const loadCategories = () => {
    fetchCategories()
      .then((data) => {
        setCategoryList(data.productCategories || []);
        setSubcategoryList(data.subcategories || []);
      })
      .catch(() => {});
  };

  const loadProducts = async ({ page = productPage, search = searchQuery } = {}) => {
    try {
      const data = await fetchAdminProducts({
        page,
        limit: PRODUCT_PAGE_SIZE,
        includeInactive: true,
        stockFilter,
        sizeFilter,
        manualFilter,
        ...(search ? { search } : {}),
      });
      const pageProducts = Array.isArray(data) ? data : data.products || [];
      const total = Number(data?.total) || 0;
      const pages = Math.max(1, Number(data?.pages) || 1);

      setProducts(pageProducts);
      setProductTotal(total);
      setProductPages(pages);

      if (page > pages) {
        setProductPage(pages);
      }
    } catch {
      setProducts([]);
      setProductTotal(0);
      setProductPages(1);
    }
  };

  const loadImportBatches = () => {
    fetchImportBatches()
      .then((data) => setImportBatches(Array.isArray(data?.batches) ? data.batches : []))
      .catch(() => setImportBatches([]));
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
      if (typeof window !== "undefined") {
        const diagnostics = res?.diagnostics || {};
        const checks = Array.isArray(diagnostics?.checks) ? diagnostics.checks : [];
        const phaseMs = diagnostics?.performance?.phaseMs || {};
        console.groupCollapsed(
          `[Excel Import] ${file.name} | imported=${res?.imported ?? 0} updated=${res?.updated ?? 0} failed=${res?.failed ?? 0} warnings=${res?.warnings ?? 0}`,
        );
        console.log("Import summary", {
          imported: res?.imported ?? 0,
          updated: res?.updated ?? 0,
          failed: res?.failed ?? 0,
          warnings: res?.warnings ?? 0,
          totalRawRows: res?.totalRawRows ?? res?.total ?? 0,
          consolidatedProducts: res?.consolidatedProducts ?? null,
          executionTime: res?.executionTime ?? null,
        });
        if (Object.keys(phaseMs).length > 0) {
          console.log("Phase timings (ms)", phaseMs);
        }
        if (checks.length > 0) {
          console.table(
            checks.map((check) => ({
              name: check?.name,
              status: check?.status,
              value: check?.value,
              message: check?.message,
            })),
          );
        }
        if (Array.isArray(res?.warningDetails) && res.warningDetails.length > 0) {
          console.warn("Upload warnings", res.warningDetails);
        }
        if (Array.isArray(res?.errors) && res.errors.length > 0) {
          console.error("Upload errors", res.errors);
        }
        console.groupEnd();
      }
      const parts = [`${res.imported ?? 0} added`, `${res.updated ?? 0} updated`];
      if (res.failed > 0) parts.push(`${res.failed} failed`);
      if (res.warnings > 0) parts.push(`${res.warnings} warnings`);
      toast.success(`Import complete: ${parts.join(", ")}.`);
      loadStats();
      loadImportBatches();
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
  const onDropImages = useCallback(async (accepted, rejected) => {
    if (rejected?.length > 0) {
      const reasons = rejected[0]?.errors?.map((e) => e.message).join(", ") || "Unknown reason";
      toast.error(`File rejected: ${reasons}`);
      return;
    }
    if (!accepted?.length) return;

    // If a single ZIP file, use the existing flow
    const isZip = accepted.length === 1 && accepted[0].name.toLowerCase().endsWith(".zip");
    if (isZip) {
      const file = accepted[0];
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

        // If backend returned a jobId, poll for progress
        if (res.jobId) {
          toast.success(`Processing ${res.total} images in the background…`);
          const jobId = res.jobId;
          const poll = setInterval(async () => {
            try {
              const status = await getImageUploadStatus(jobId);
              setProgress(status.percent || 0);
              setImageResult({
                matched: status.matched,
                unmatched: status.unmatched,
                errors: status.errors,
                unmatchedFiles: status.unmatchedFiles,
                total: status.total,
                processed: status.processed,
                status: status.status,
              });

              if (status.status === "complete" || status.status === "failed") {
                clearInterval(poll);
                setUploading(false);
                setProgress(0);
                setServerProcessing(false);
                if (status.status === "complete") {
                  toast.success(`Done! ${status.matched} images matched to products.`);
                } else {
                  toast.error("Image processing failed. Check errors below.");
                }
                loadProducts({ page: productPage, search: searchQuery });
                loadStats();
              }
            } catch {
              clearInterval(poll);
              setUploading(false);
              setProgress(0);
              setServerProcessing(false);
            }
          }, 3000);
        } else {
          setImageResult(res);
          toast.success(`${res.matched ?? 0} images matched to products.`);
          setUploading(false);
          setProgress(0);
          setServerProcessing(false);
          loadProducts({ page: productPage, search: searchQuery });
          loadStats();
        }
      } catch (err) {
        const msg = err?.response?.data?.error || "Image upload failed.";
        toast.error(msg);
        setUploading(false);
        setProgress(0);
        setServerProcessing(false);
      }
      return;
    }

    // Multiple individual images — upload one by one
    setUploading(true);
    setProgress(0);
    setServerProcessing(false);
    setImageResult(null);
    let totalMatched = 0;
    let totalUnmatched = 0;
    const allUnmatchedFiles = [];
    const allErrors = [];

    for (let i = 0; i < accepted.length; i++) {
      try {
        const res = await uploadImages(accepted[i], () => {});
        totalMatched += res.matched ?? 0;
        totalUnmatched += res.unmatched ?? 0;
        if (res.unmatchedFiles) allUnmatchedFiles.push(...res.unmatchedFiles);
        if (res.errors) allErrors.push(...res.errors);
      } catch {
        allErrors.push(accepted[i].name);
      }
      setProgress(Math.round(((i + 1) / accepted.length) * 100));
    }

    setImageResult({
      matched: totalMatched,
      unmatched: totalUnmatched,
      errors: allErrors,
      unmatchedFiles: allUnmatchedFiles,
      total: accepted.length,
    });
    toast.success(`${totalMatched} of ${accepted.length} images matched to products.`);
    setUploading(false);
    setProgress(0);
    loadProducts({ page: productPage, search: searchQuery });
    loadStats();
  }, []);

  const imageZone = useDropzone({
    onDrop: onDropImages,
    accept: {
      "application/zip": [".zip"],
      "application/x-zip-compressed": [".zip"],
      "application/x-zip": [".zip"],
      "application/octet-stream": [".zip"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
    maxSize: 100 * 1024 * 1024, // 100 MB
    multiple: true,
    disabled: uploading,
  });

  /* ── Delete single product ── */
  const handleDelete = async (sku) => {
    if (!window.confirm(`Delete product ${sku}?`)) return;
    try {
      await deleteProduct(sku);
      toast.success("Product deleted.");
      loadProducts({ page: productPage, search: searchQuery });
    } catch {
      toast.error("Failed to delete product.");
    }
  };

  /* ── Clear all products (with safety confirmation) ── */
  const handleClearAll = async () => {
    const count = stats?.total ?? products.length;
    const confirmCode = `DELETE-ALL-${count}`;
    const typed = window.prompt(
      `⚠️ DANGER: This will delete ALL ${count.toLocaleString()} products.\n\nA backup will be saved so you can restore later.\n\nTo confirm, type exactly:\n${confirmCode}`,
    );
    if (!typed || typed.trim() !== confirmCode) {
      if (typed !== null) toast.error("Confirmation code did not match. No products deleted.");
      return;
    }
    try {
      const result = await deleteAllProducts(confirmCode);
      toast.success(result.message || "All products cleared. Backup saved.");
      setProducts([]);
      loadStats();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to clear products.");
    }
  };

  /* ── Restore products from backup ── */
  const handleRestore = async () => {
    try {
      const data = await fetchDeletedBatches();
      const batches = (data.batches || []).filter(b => !b.restored);
      if (batches.length === 0) {
        toast("No backup batches available to restore.");
        return;
      }
      const list = batches.map((b, i) =>
        `${i + 1}. ${b.reason} — ${b.count} products (${new Date(b.createdAt).toLocaleDateString()})`
      ).join("\n");
      const choice = window.prompt(
        `Available backups:\n\n${list}\n\nEnter the number to restore (1-${batches.length}):`,
      );
      if (!choice) return;
      const idx = parseInt(choice, 10) - 1;
      if (isNaN(idx) || idx < 0 || idx >= batches.length) {
        toast.error("Invalid selection.");
        return;
      }
      const batch = batches[idx];
      if (!window.confirm(`Restore ${batch.count} products from "${batch.reason}"?\n\nExisting products with same SKU will be skipped.`)) return;
      const result = await restoreProducts(batch._id);
      toast.success(result.message || `Restored ${result.restored} products.`);
      loadProducts({ page: productPage, search: searchQuery });
      loadStats();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to restore products.");
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
    setProductImageFile(null);
    setProductImagePreview(null);
  };

  const startEdit = (product) => {
    if (!product) {
      console.error("[AdminPage] startEdit called with null product");
      return;
    }

    const sizesArr = Array.isArray(product.sizes) ? product.sizes : [];

    // Format sizes for editing: if we have {size, quantity} objects, show "S(qty), M(qty)" format
    // This makes it clear to admin what qty each size has
    let sizesStr = "";
    let qtyStr = "";

    if (sizesArr.length > 0) {
      if (typeof sizesArr[0] === "object" && sizesArr[0].quantity !== undefined) {
        // Format: "M(5), L(3), XL(1)" - shows qty per size
        sizesStr = sizesArr
          .map((s) => `${s.size}(${s.quantity || 0})`)
          .join(", ");
        // Total qty for reference
        qtyStr = sizesArr
          .reduce((sum, s) => sum + (s.quantity || 0), 0)
          .toString();
        
        // Log for debugging Issue #4
        console.log(
          `[AdminPage] Editing ${product.sku}: sizes="${sizesStr}" total_qty=${qtyStr}`,
        );
      } else {
        // Fallback for old format (just strings)
        sizesStr = sizesArr.join(", ");
        qtyStr = (product.totalQuantity || product.quantity || "").toString();
      }
    } else {
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
    setProductImageFile(null);
    setProductImagePreview(resolveImageUrl(product.imageUrl || product.image) || null);
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
      let savedProduct;
      if (editingSku) {
        try {
          const res = await updateProduct(editingSku, productForm);
          savedProduct = res.product;
          toast.success("Product updated successfully.");
        } catch (updateErr) {
          const errorMsg = updateErr?.response?.data?.error || updateErr?.response?.data?.details || updateErr.message || "Failed to update product.";
          console.error("[AdminPage] Update error:", errorMsg);
          throw updateErr;
        }
      } else {
        const res = await addProduct(productForm);
        savedProduct = res.product;
        toast.success("Product added successfully.");
      }

      // Upload image if one was dragged onto the form
      if (productImageFile && savedProduct?.sku) {
        try {
          await uploadProductImage(savedProduct.sku, productImageFile);
          toast.success("Image uploaded successfully.");
        } catch (imgErr) {
          console.error("[AdminPage] Image upload error:", imgErr);
          toast.error("Product saved but image upload failed: " + (imgErr?.response?.data?.error || imgErr.message));
        }
      }

      resetForm();
      loadProducts({ page: productPage, search: searchQuery });
      debouncedLoadStats();
      setTab("products");
    } catch (err) {
      const displayError = err?.response?.data?.error || err.message || "Failed to save product.";
      console.error("[AdminPage] Save failed:", displayError, err);
      toast.error(displayError);
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

  const uploadDiagnostics = excelResult?.diagnostics || null;
  const uploadChecks = Array.isArray(uploadDiagnostics?.checks)
    ? uploadDiagnostics.checks
    : [];
  const uploadWarnings = Array.isArray(excelResult?.warningDetails)
    ? excelResult.warningDetails
    : [];
  const uploadErrors = Array.isArray(excelResult?.errors) ? excelResult.errors : [];
  const uploadPhaseMs = uploadDiagnostics?.performance?.phaseMs || {};

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
            {/* Use the stats endpoint total (authoritative backend count). */}
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
            { key: "imports", icon: "🧾", label: "Import History" },
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
                if (t.key === "products") setProductPage(1);
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
            <button
              className="btn btn-sm btn-outline"
              title="Move all products from one category to another"
              onClick={async () => {
                const from = window.prompt("Move FROM category (e.g. CLOTHING):");
                if (!from) return;
                const to = window.prompt("Move TO category (e.g. LICENSED TEAM CLOTHING):");
                if (!to) return;
                const sub = window.prompt("Set subcategory (optional, leave blank to keep existing):");
                if (!window.confirm(`Move all "${from}" products to "${to}"${sub ? ` / "${sub}"` : ""}?`)) return;
                try {
                  const r = await bulkRecategorize({
                    fromCategory: from,
                    category: to,
                    ...(sub ? { subcategory: sub } : {}),
                  });
                  toast.success(r.message || `Recategorized ${r.updated} products.`);
                  loadProducts({ page: productPage, search: searchQuery });
                  loadStats();
                  loadCategories();
                } catch (err) {
                  toast.error(err?.response?.data?.error || "Recategorize failed.");
                }
              }}
            >
              📁 Bulk Recategorize
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
              <div>
                <div
                  className={`import-result ${excelResult.failed > 0 ? "warning" : "success"}`}
                >
                  <strong>
                    Import Summary: {excelResult.imported ?? 0} imported, {excelResult.updated ?? 0} updated, {excelResult.failed ?? 0} failed, {excelResult.warnings ?? 0} warnings, {excelResult.totalRawRows ?? excelResult.total ?? 0} raw rows to {excelResult.consolidatedProducts ?? "?"} SKUs
                    {excelResult.executionTime ? ` in ${excelResult.executionTime}` : ""}.
                  </strong>
                </div>

                <div style={{ marginTop: "0.9rem", display: "grid", gap: "0.75rem" }}>
                  {uploadDiagnostics && (
                    <div
                      style={{
                        border: "1px solid #e5e7eb",
                        background: "#f9fafb",
                        borderRadius: "12px",
                        padding: "0.85rem",
                      }}
                    >
                      <div style={{ fontWeight: 700, color: "#111827", marginBottom: "0.5rem" }}>
                        Diagnostics
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                          gap: "0.65rem",
                          fontSize: "0.86rem",
                        }}
                      >
                        <div>
                          <strong>{uploadDiagnostics?.performance?.totalMs ?? "-"}</strong>
                          <div style={{ color: "#6b7280" }}>Total ms</div>
                        </div>
                        <div>
                          <strong>{uploadDiagnostics?.performance?.rowsPerSecond ?? "-"}</strong>
                          <div style={{ color: "#6b7280" }}>Rows / sec</div>
                        </div>
                        <div>
                          <strong>{uploadDiagnostics?.mapping?.mappedFields ?? "-"}</strong>
                          <div style={{ color: "#6b7280" }}>Mapped fields</div>
                        </div>
                        <div>
                          <strong>{uploadDiagnostics?.mapping?.unmappedHeaderCount ?? "-"}</strong>
                          <div style={{ color: "#6b7280" }}>Unmapped headers</div>
                        </div>
                      </div>

                      {Object.keys(uploadPhaseMs).length > 0 && (
                        <details style={{ marginTop: "0.75rem" }}>
                          <summary style={{ cursor: "pointer", fontWeight: 600, color: "#1f2937" }}>
                            Phase timings
                          </summary>
                          <div style={{ marginTop: "0.5rem", display: "grid", gap: "0.35rem", fontSize: "0.84rem" }}>
                            {Object.entries(uploadPhaseMs).map(([name, value]) => (
                              <div key={name} style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                                <span style={{ color: "#374151" }}>{name}</span>
                                <strong>{value ?? "-"} ms</strong>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}

                      {uploadChecks.length > 0 && (
                        <details style={{ marginTop: "0.75rem" }}>
                          <summary style={{ cursor: "pointer", fontWeight: 600, color: "#1f2937" }}>
                            Checks ({uploadChecks.length})
                          </summary>
                          <div style={{ marginTop: "0.5rem", display: "grid", gap: "0.45rem" }}>
                            {uploadChecks.map((check, idx) => {
                              const tone =
                                check?.status === "fail"
                                  ? { bg: "#fef2f2", border: "#fecaca", color: "#991b1b" }
                                  : check?.status === "warn"
                                    ? { bg: "#fffbeb", border: "#fcd34d", color: "#92400e" }
                                    : { bg: "#f0fdf4", border: "#bbf7d0", color: "#166534" };
                              return (
                                <div
                                  key={`${check?.name || "check"}-${idx}`}
                                  style={{
                                    border: `1px solid ${tone.border}`,
                                    background: tone.bg,
                                    borderRadius: "10px",
                                    padding: "0.55rem 0.65rem",
                                    fontSize: "0.84rem",
                                  }}
                                >
                                  <div style={{ color: tone.color, fontWeight: 700 }}>
                                    {(check?.status || "info").toUpperCase()} · {check?.name || "check"}
                                  </div>
                                  <div style={{ marginTop: "0.2rem", color: "#374151" }}>
                                    {check?.message || "No message"}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      )}
                    </div>
                  )}

                  {uploadWarnings.length > 0 && (
                    <details style={{ border: "1px solid #fde68a", borderRadius: "12px", padding: "0.75rem", background: "#fffbeb" }}>
                      <summary style={{ cursor: "pointer", fontWeight: 700, color: "#92400e" }}>
                        Warnings ({uploadWarnings.length})
                      </summary>
                      <div style={{ marginTop: "0.6rem", display: "grid", gap: "0.45rem" }}>
                        {uploadWarnings.slice(0, 50).map((warning, idx) => (
                          <div
                            key={`warn-${idx}`}
                            style={{
                              fontSize: "0.84rem",
                              borderRadius: "8px",
                              background: "#fff",
                              border: "1px solid #fde68a",
                              padding: "0.5rem 0.6rem",
                            }}
                          >
                            <div style={{ fontWeight: 600, color: "#78350f" }}>
                              Row {warning?.row || "-"} {warning?.sku ? `· ${warning.sku}` : ""}
                            </div>
                            <div style={{ color: "#4b5563", marginTop: "0.15rem" }}>
                              {warning?.message || warning?.reason || "Warning"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  {uploadErrors.length > 0 && (
                    <details style={{ border: "1px solid #fecaca", borderRadius: "12px", padding: "0.75rem", background: "#fef2f2" }}>
                      <summary style={{ cursor: "pointer", fontWeight: 700, color: "#991b1b" }}>
                        Errors ({uploadErrors.length})
                      </summary>
                      <div style={{ marginTop: "0.6rem", display: "grid", gap: "0.45rem" }}>
                        {uploadErrors.slice(0, 50).map((error, idx) => (
                          <div
                            key={`err-${idx}`}
                            style={{
                              fontSize: "0.84rem",
                              borderRadius: "8px",
                              background: "#fff",
                              border: "1px solid #fecaca",
                              padding: "0.5rem 0.6rem",
                            }}
                          >
                            <div style={{ fontWeight: 600, color: "#7f1d1d" }}>
                              Row {error?.row || "-"} {error?.sku ? `· ${error.sku}` : ""}
                            </div>
                            <div style={{ color: "#4b5563", marginTop: "0.15rem" }}>
                              {error?.reason || error?.message || "Error"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "imports" && (
          <div className="admin-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1rem",
                marginBottom: "1rem",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h3 style={{ marginBottom: "0.35rem" }}>Recent Import Batches</h3>
                <p className="admin-hint" style={{ marginBottom: 0 }}>
                  Review failed rows, quarantined size tokens, and batch-level outcomes without checking server logs.
                </p>
              </div>
              <button className="btn btn-sm btn-outline" onClick={loadImportBatches}>
                Refresh
              </button>
            </div>

            {importBatches.length === 0 ? (
              <p style={{ color: "#6b7280", margin: 0 }}>No import batches recorded yet.</p>
            ) : (
              <div style={{ display: "grid", gap: "1rem" }}>
                {importBatches.map((batch) => {
                  const statusColor =
                    batch.status === "complete"
                      ? "#059669"
                      : batch.status === "failed"
                        ? "#b91c1c"
                        : "#b45309";

                  return (
                    <div
                      key={batch._id}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: "14px",
                        padding: "1rem",
                        background: "#ffffff",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "1rem",
                          flexWrap: "wrap",
                          alignItems: "flex-start",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, color: "#111827" }}>{batch.filename}</div>
                          <div style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: "0.25rem" }}>
                            {new Date(batch.createdAt).toLocaleString()}
                            {batch.importedBy?.email ? ` · ${batch.importedBy.email}` : ""}
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: "0.78rem",
                            fontWeight: 700,
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                            color: statusColor,
                          }}
                        >
                          {batch.status}
                        </span>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                          gap: "0.75rem",
                          marginTop: "1rem",
                        }}
                      >
                        <div><strong>{batch.totalRows || 0}</strong><div style={{ color: "#6b7280", fontSize: "0.82rem" }}>Rows</div></div>
                        <div><strong>{batch.importedRows || 0}</strong><div style={{ color: "#6b7280", fontSize: "0.82rem" }}>Imported</div></div>
                        <div><strong>{batch.updatedRows || 0}</strong><div style={{ color: "#6b7280", fontSize: "0.82rem" }}>Updated</div></div>
                        <div><strong>{batch.failedRows || 0}</strong><div style={{ color: "#6b7280", fontSize: "0.82rem" }}>Failed</div></div>
                        <div><strong>{batch.errorLog?.length || 0}</strong><div style={{ color: "#6b7280", fontSize: "0.82rem" }}>Logged Issues</div></div>
                      </div>

                      {Array.isArray(batch.errorLog) && batch.errorLog.length > 0 && (
                        <details style={{ marginTop: "1rem" }}>
                          <summary style={{ cursor: "pointer", fontWeight: 600, color: "#991b1b" }}>
                            View {batch.errorLog.length} issue{batch.errorLog.length === 1 ? "" : "s"}
                          </summary>
                          <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.5rem" }}>
                            {batch.errorLog.map((entry, index) => (
                              <div
                                key={`${batch._id}-${index}`}
                                style={{
                                  background: "#f9fafb",
                                  borderRadius: "10px",
                                  padding: "0.75rem",
                                  fontSize: "0.88rem",
                                }}
                              >
                                <strong>Row {entry.row || 0}</strong>
                                {entry.sku ? ` · ${entry.sku}` : ""}
                                <div style={{ color: "#4b5563", marginTop: "0.25rem" }}>{entry.reason}</div>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Images Tab ── */}
        {tab === "images" && (
          <div className="admin-card">
            <h3>Bulk Image Upload (ZIP)</h3>
            <p className="admin-hint">
              Upload a <strong>.zip</strong> archive or drag individual images.
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
                  ? imageResult?.status === "processing"
                    ? `⏳ Processing images… ${imageResult.processed ?? 0} / ${imageResult.total ?? "?"} (${progress}%)`
                    : "⏳ Matching images to products & uploading to cloud…"
                  : uploading
                    ? `Uploading… ${progress}%`
                    : "Drop .zip archive or images here, or click to browse"}
              </p>
              <span className="dropzone-hint">
                Supports .zip archive or individual .jpg, .png, .webp images — up to 100 MB
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
                  {serverProcessing
                    ? `${imageResult?.processed ?? 0} / ${imageResult?.total ?? "?"} images — ${imageResult?.matched ?? 0} matched (${progress}%)`
                    : `${progress}%`}
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
                  placeholder="e.g. FOOTWEAR, CLOTHING"
                  list="category-list"
                />
                <datalist id="category-list">
                  {categoryList.map((c) => (
                    <option key={c} value={c} />
                  ))}
                  <option value="FOOTWEAR" />
                  <option value="CLOTHING" />
                  <option value="ACCESSORIES" />
                  <option value="LICENSED TEAM CLOTHING" />
                  <option value="B GRADE" />
                </datalist>
              </div>
              <div className="form-field">
                <label>Subcategory</label>
                <input
                  name="subcategory"
                  value={productForm.subcategory}
                  onChange={handleFormChange}
                  placeholder="e.g. Real Madrid"
                  list="subcategory-list"
                />
                <datalist id="subcategory-list">
                  {subcategoryList.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
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
                <label>Sizes (comma-separated, with qty per size: 8:50, 9:40, 10:30)</label>
                <input
                  name="sizes"
                  value={productForm.sizes}
                  onChange={handleFormChange}
                  placeholder="S, M, L, XL  or  8:50, 9:40, 10:30"
                />
                <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                  Use "size:qty" format for per-size quantities, or just sizes with a total quantity below.
                </span>
              </div>
              <div className="form-field">
                <label>Total Quantity</label>
                <input
                  name="quantity"
                  value={productForm.quantity}
                  onChange={handleFormChange}
                  placeholder="e.g. 100"
                />
              </div>

              {/* ── Image drag-and-drop ── */}
              <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                <label>Product Image</label>
                <div
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file && file.type.startsWith("image/")) {
                      setProductImageFile(file);
                      setProductImagePreview(URL.createObjectURL(file));
                    } else {
                      toast.error("Please drop an image file.");
                    }
                  }}
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.onchange = (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setProductImageFile(file);
                        setProductImagePreview(URL.createObjectURL(file));
                      }
                    };
                    input.click();
                  }}
                  style={{
                    border: "2px dashed #d1d5db",
                    borderRadius: "8px",
                    padding: "1.5rem",
                    textAlign: "center",
                    cursor: "pointer",
                    background: productImagePreview ? "#f0fdf4" : "#f9fafb",
                    transition: "all 0.2s",
                    minHeight: "100px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                  }}
                >
                  {productImagePreview ? (
                    <>
                      <img
                        src={productImagePreview}
                        alt="Preview"
                        style={{ maxHeight: "120px", maxWidth: "100%", objectFit: "contain", borderRadius: "4px" }}
                      />
                      <span style={{ fontSize: "0.8rem", color: "#059669" }}>
                        {productImageFile ? productImageFile.name : "Current image"} — Click or drag to replace
                      </span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: "2rem" }}>📷</span>
                      <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                        Drag &amp; drop an image here, or click to browse
                      </span>
                    </>
                  )}
                </div>
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
                Product List — showing {products.length} of {productTotal.toLocaleString()}
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
              <button
                className="btn btn-sm"
                style={{
                  background: "#0e7490",
                  color: "#fff",
                  fontSize: "0.8rem",
                }}
                onClick={handleRestore}
              >
                ♻️ Restore Products
              </button>
            </div>

            {/* Search across all products (server-side) */}
            <div style={{ marginBottom: "1rem" }}>
              <input
                type="text"
                placeholder="Search all products by SKU, name, brand, category, subcategory, color…"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setProductPage(1);
                }}
                style={{
                  width: "100%",
                  padding: "0.55rem 0.75rem",
                  border: "1.5px solid #e5e7eb",
                  borderRadius: "6px",
                  fontSize: "0.9rem",
                  outline: "none",
                }}
              />
              <p className="admin-hint" style={{ marginTop: "0.5rem", marginBottom: 0 }}>
                {searchQuery
                  ? `Search results: ${productTotal.toLocaleString()} match(es)`
                  : `Total products in database: ${productTotal.toLocaleString()}`}
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "0.75rem",
                marginBottom: "1rem",
              }}
            >
              <label style={{ fontSize: "0.85rem", color: "#374151", fontWeight: 600 }}>
                Stock
                <select
                  value={stockFilter}
                  onChange={(e) => {
                    setStockFilter(e.target.value);
                    setProductPage(1);
                  }}
                  style={{ width: "100%", marginTop: "0.35rem", padding: "0.55rem 0.75rem", border: "1.5px solid #e5e7eb", borderRadius: "6px" }}
                >
                  <option value="all">All stock levels</option>
                  <option value="positive">In stock</option>
                  <option value="zero">Quantity = 0</option>
                </select>
              </label>

              <label style={{ fontSize: "0.85rem", color: "#374151", fontWeight: 600 }}>
                Sizes
                <select
                  value={sizeFilter}
                  onChange={(e) => {
                    setSizeFilter(e.target.value);
                    setProductPage(1);
                  }}
                  style={{ width: "100%", marginTop: "0.35rem", padding: "0.55rem 0.75rem", border: "1.5px solid #e5e7eb", borderRadius: "6px" }}
                >
                  <option value="all">All sizes</option>
                  <option value="has">Has sizes</option>
                  <option value="empty">Empty sizes</option>
                </select>
              </label>

              <label style={{ fontSize: "0.85rem", color: "#374151", fontWeight: 600 }}>
                Source
                <select
                  value={manualFilter}
                  onChange={(e) => {
                    setManualFilter(e.target.value);
                    setProductPage(1);
                  }}
                  style={{ width: "100%", marginTop: "0.35rem", padding: "0.55rem 0.75rem", border: "1.5px solid #e5e7eb", borderRadius: "6px" }}
                >
                  <option value="all">All products</option>
                  <option value="manual">Manual edits</option>
                  <option value="auto">Imported / auto</option>
                </select>
              </label>

              <div style={{ display: "flex", alignItems: "end" }}>
                <button
                  className="btn btn-outline"
                  style={{ width: "100%" }}
                  onClick={() => {
                    setSearchQuery("");
                    setStockFilter("all");
                    setSizeFilter("all");
                    setManualFilter("all");
                    setProductPage(1);
                  }}
                >
                  Clear Filters
                </button>
              </div>
            </div>

            <p className="admin-hint" style={{ marginTop: "-0.25rem", marginBottom: "1rem" }}>
              Use these filters to find zero-stock items, empty-size products, or only manual/imported records.
            </p>

            {products.length === 0 ? (
              <p className="admin-hint">
                {searchQuery
                  ? `No products match "${searchQuery}".`
                  : "No products yet. Upload an Excel file to get started."}
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
                    {products.map((p) => {
                      const salePrice = Number(p.salePrice || p.price) || 0;
                      const rrpVal = Number(p.rrp) || 0;
                      const discPct =
                        p.discountPercentage ||
                        (rrpVal > 0 && salePrice < rrpVal
                          ? Math.round(((rrpVal - salePrice) / rrpVal) * 100)
                          : 0);
                      const sizesArr = getSizes(p);
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
                          `${s.size}(${s.quantity || 0})`,
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
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "0.75rem",
                    flexWrap: "wrap",
                    marginTop: "0.9rem",
                  }}
                >
                  <p className="admin-hint" style={{ margin: 0 }}>
                    Page {productPage} of {productPages}
                  </p>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <button
                      className="btn btn-sm btn-outline"
                      disabled={productPage <= 1}
                      onClick={() => setProductPage((p) => Math.max(1, p - 1))}
                    >
                      Prev
                    </button>
                    <button
                      className="btn btn-sm btn-outline"
                      disabled={productPage >= productPages}
                      onClick={() => setProductPage((p) => Math.min(productPages, p + 1))}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
