import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';
import { formatDateTime, formatPrice } from '../lib/format';
import StatusBadge from '../components/StatusBadge';

// Full order detail (Lab 06) - reached from "View Details" on /orders.
export default function OrderDetails() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/orders/${id}`);
        if (active) setOrder(data.order);
      } catch (err) {
        if (active) {
          const status = err.response?.status;
          setError(
            status === 404
              ? 'Order not found.'
              : status === 400
                ? 'Invalid order ID.'
                : err.response?.data?.message || 'Unable to load this order.'
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

  if (loading) {
    return (
      <div className="page">
        <p className="muted">Loading order...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="form wide">
          <p className="error">{error}</p>
          <Link className="btn" to="/orders">
            Back to orders
          </Link>
        </div>
      </div>
    );
  }

  if (!order) return null;

  const { fullName, phone, addressLine1, city, state, pincode } = order.shippingAddress || {};
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="page wide-page">
      <Link className="back-link" to="/orders">
        &larr; Back to Orders
      </Link>
      <div className="panel success-panel">
        <h2>Order #{order._id}</h2>

        <div className="order-meta">
          <p>
            <strong>Placed:</strong> {formatDateTime(order.createdAt)}
          </p>
          <p>
            <strong>Items:</strong> {itemCount}
          </p>
          <p>
            <strong>Total:</strong> <span className="price">{formatPrice(order.totalAmount)}</span>
          </p>
          <StatusBadge status={order.status} paymentStatus={order.paymentStatus} />
          {order.razorpayOrderId && (
            <p className="muted small">Razorpay order ID: {order.razorpayOrderId}</p>
          )}
          {order.razorpayPaymentId && (
            <p className="muted small">Razorpay payment ID: {order.razorpayPaymentId}</p>
          )}
        </div>

        <h3>Items</h3>
        <div className="list">
          {order.items.map((item, index) => (
            <div className="row" key={`${item.product}-${index}`}>
              <img src={item.image} alt={item.name} loading="lazy" />
              <div className="row-info">
                <h3>{item.name}</h3>
                <p className="muted">
                  {formatPrice(item.price)} x {item.quantity}
                </p>
              </div>
              <div className="row-actions">
                <p className="line-total">{formatPrice(item.price * item.quantity)}</p>
                <Link className="btn btn-outline-dark" to={`/products/${item.product}`}>
                  Buy again
                </Link>
              </div>
            </div>
          ))}
        </div>

        <h3>Shipping address</h3>
        <p className="muted">
          {fullName} &bull; {phone}
          <br />
          {addressLine1}, {city}, {state} - {pincode}
        </p>

        <div className="actions-row">
          <Link className="btn" to="/orders">
            View My Orders
          </Link>
          <Link className="btn btn-outline-dark" to="/products">
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}