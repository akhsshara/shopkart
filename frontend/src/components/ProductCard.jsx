import { Link } from 'react-router-dom';

export function formatPrice(price) {
  return `₹${Number(price).toLocaleString('en-IN')}`;
}

export default function ProductCard({ product }) {
  const outOfStock = product.stock <= 0;
  return (
    <div className="card">
      <img src={product.image} alt={product.name} loading="lazy" />
      <div className="card-body">
        <h3>{product.name}</h3>
        <p className="muted">{product.category}</p>
        <p className="price">{formatPrice(product.price)}</p>
        <p className={outOfStock ? 'out' : 'in'}>
          {outOfStock ? 'Out of stock' : `${product.stock} units left`}
        </p>
        <Link className="btn" to={`/products/${product._id}`}>
          View Details
        </Link>
      </div>
    </div>
  );
}
