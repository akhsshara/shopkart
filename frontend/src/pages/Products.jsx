import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import ProductCard from '../components/ProductCard';
import SearchBar from '../components/SearchBar';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Debounce search so we don't spam the API on every keystroke
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (debouncedSearch) params.search = debouncedSearch;
      if (category) params.category = category;
      if (sort) params.sort = sort;
      const { data } = await api.get('/products', { params });
      setProducts(data.products ?? []);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong while loading products.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, category, sort]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="page wide-page">
      <h2>Products</h2>
      <SearchBar
        search={search}
        setSearch={setSearch}
        category={category}
        setCategory={setCategory}
        sort={sort}
        setSort={setSort}
      />
      {loading && <p>Loading products...</p>}
      {!loading && error && <p className="error">{error}</p>}
      {!loading && !error && products.length === 0 && <p>No products found.</p>}
      {!loading && !error && products.length > 0 && (
        <div className="grid">
          {products.map((p) => (
            <ProductCard key={p._id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}