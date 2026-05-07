import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { initGlobalErrorReporting } from "./utils/errorReporter";
import { fetchConfig } from "./api/api";

// Initialize global error capture (unhandled errors + promise rejections → backend logs)
initGlobalErrorReporting();

// Pre-fetch MOQ config from backend
fetchConfig().catch(() => {});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
