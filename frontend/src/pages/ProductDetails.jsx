import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchProductById } from '../services/api';
import { formatPrice } from '../components/ProductCard';

export default function ProductDetails() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetchProductById(id);
        if (active) setProduct(res.data.product);
      } catch (err) {
        if (active) {
          const status = err.response?.status;
          setError(
            status === 404
              ? 'Product not found.'
              : status === 400
                ? 'Invalid product ID.'
                : 'Something went wrong while loading products.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) return <div className="page"><p>Loading products...</p></div>;
  if (error) return <div className="page"><p className="error">{error}</p><Link to="/products">Back</Link></div>;
  if (!product) return <div className="page"><p>No products found.</p></div>;

  return (
    <div className="page">
      <div className="details">
        <img src={product.image} alt={product.name} />
        <div>
          <h2>{product.name}</h2>
          <p className="muted">{product.category}</p>
          <p className="price">{formatPrice(product.price)}</p>
          <p>{product.description}</p>
          <p>{product.stock > 0 ? `${product.stock} units in stock` : 'Out of stock'}</p>
          <button className="btn" type="button" disabled={product.stock <= 0}>
            Add to Cart
          </button>
          <p className="muted">Cart checkout arrives in Lab 04.</p>
          <Link to="/products">Back to products</Link>
        </div>
      </div>
    </div>
  );
}
