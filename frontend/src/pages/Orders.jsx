import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { formatDateTime, formatPrice } from '../lib/format';
import StatusBadge from '../components/StatusBadge';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    (async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/orders');
        if (active) setOrders(data.orders ?? []); // newest first, own orders only
      } catch (err) {
        if (active) setError(err.response?.data?.message || 'Unable to load your orders.');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="page wide-page">
      <h2>My Orders</h2>

      {loading && <p className="muted">Loading your orders...</p>}

      {!loading && error && (
        <>
          <p className="error">{error}</p>
          <button className="link-btn" type="button" onClick={() => setError('')}>
            Dismiss
          </button>
        </>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="empty-state">
          <p>You have not placed any orders yet.</p>
          <Link className="btn" to="/products">
            Start shopping
          </Link>
        </div>
      )}

      {!loading && !error && orders.length > 0 && (
        <div className="list">
          {orders.map((order) => {
            const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
            return (
              <div className="row order-row" key={order._id}>
                <div className="row-info">
                  <h3>Order #{order._id}</h3>
                  <p className="muted">
                    {formatDateTime(order.createdAt)} &bull; {itemCount} item(s)
                  </p>
                  <StatusBadge status={order.status} paymentStatus={order.paymentStatus} />
                  <p className="price big">{formatPrice(order.totalAmount)}</p>

                  <ul className="order-items">
                    {order.items.map((item, index) => (
                      <li key={`${item.product}-${index}`}>
                        {item.name} x {item.quantity}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="row-actions">
                  <Link className="btn" to={`/orders/${order._id}`}>
                    View Details
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}