import { useState } from "react";

export default function SearchBar({ onSearch, placeholder }) {
  const [query, setQuery] = useState("");

  const submit = (e) => {
    e.preventDefault();
    onSearch(query.trim());
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    // Auto-search when cleared
    if (!val.trim()) onSearch("");
  };

  return (
    <form className="search-bar" onSubmit={submit}>
      <input
        type="text"
        placeholder={placeholder || "Search products…"}
        value={query}
        onChange={handleChange}
      />
      <button type="submit" className="btn btn-primary btn-sm">
        Search
      </button>
    </form>
  );
}
