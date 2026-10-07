import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import api from '../services/api';
import { loadRazorpayScript } from '../lib/razorpay';
import { formatPrice } from '../lib/format';

const FIELDS = [
  { name: 'fullName', label: 'Full Name', type: 'text', placeholder: 'John Doe' },
  { name: 'phone', label: 'Phone', type: 'tel', placeholder: '9876543210' },
  { name: 'addressLine1', label: 'Address Line 1', type: 'text', placeholder: '221B Baker Street' },
  { name: 'city', label: 'City', type: 'text', placeholder: 'Pune' },
  { name: 'state', label: 'State', type: 'text', placeholder: 'Maharashtra' },
  { name: 'pincode', label: 'Pincode', type: 'text', placeholder: '411001' },
];

const EMPTY_FORM = FIELDS.reduce((acc, field) => ({ ...acc, [field.name]: '' }), {});

// Mirrors the backend rules so an obviously invalid form never fires a request.
function validate(form) {
  const errors = {};

  for (const field of FIELDS) {
    if (!form[field.name].trim()) errors[field.name] = `${field.label} is required`;
  }

  if (!errors.phone) {
    const digits = form.phone.replace(/[\s-]/g, '').replace(/^(\+91|91)/, '');
    if (!/^[0-9]{10}$/.test(digits)) errors.phone = 'Phone must be a valid 10-digit number';
  }
  if (!errors.pincode && !/^[0-9]{6}$/.test(form.pincode)) {
    errors.pincode = 'Pincode must contain 6 digits';
  }

  return errors;
}

export default function Checkout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { cartItems, loading, subtotal, totalUnits, clearCart } = useCart();

  // Two distinct in-flight phases so the button label tells the truth about
  // which step is running: (1) creating the order, (2) verifying the payment.
  const [phase, setPhase] = useState('idle'); // idle | creating | verifying
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});

  // Guards against a double submit creating two payment orders.
  const busyRef = useRef(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => (prev[name] ? { ...prev, [name]: '' } : prev));
  };

  /**
   * Step 2: Razorpay's handler gave us payment details. The handler firing
   * PROVES NOTHING - anyone can POST a fake success. The only real proof is the
   * HMAC signature, which the backend checks with the Key Secret, so we just
   * forward the ids and let the server decide.
   */
  const handlePaymentResponse = async (response, shopKartOrderId) => {
    setPhase('verifying');
    setError('');
    try {
      const { data } = await api.post('/orders/verify-payment', {
        shopKartOrderId,
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      });

      // The backend has cleared the persisted cart. Mirror that in global state
      // immediately so the Navbar reads Cart (0) with no page refresh.
      clearCart();
      navigate(`/order-success/${data.order._id}`, { replace: true });
    } catch (err) {
      // Signature failed / order still unpaid -> cart is deliberately intact.
      setPhase('idle');
      setError(
        err.response?.data?.message ||
          'We could not verify your payment. Your cart has been saved - please try again.'
      );
    } finally {
      busyRef.current = false;
    }
  };

  const handlePlaceOrder = async (shippingAddress) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setError('');

    // ---- Step 1: the server validates the cart + live stock + live prices,
    // snapshots the order and creates the Razorpay order. It does NOT clear
    // the cart.
    try {
      setPhase('creating');
      const { data } = await api.post('/orders/create-payment-order', { shippingAddress });

      const scriptReady = await loadRazorpayScript();
      if (!scriptReady) {
        setPhase('idle');
        busyRef.current = false;
        setError('Could not load the Razorpay checkout. Check your network and try again.');
        return;
      }

      setPhase('idle'); // the modal is about to take over the screen

      const paymentObject = new window.Razorpay({
        key: data.key, // Key ID only - the Key Secret never leaves the backend
        amount: data.amount, // already in paise, calculated server-side
        currency: data.currency,
        name: 'ShopKart',
        description: `Order #${String(data.shopKartOrderId).slice(-6).toUpperCase()}`,
        order_id: data.razorpayOrderId,
        prefill: {
          name: shippingAddress.fullName,
          email: user?.email || '',
          contact: shippingAddress.phone,
        },
        notes: {
          shopKartOrderId: data.shopKartOrderId,
          shippingAddress: `${shippingAddress.addressLine1}, ${shippingAddress.city}`,
        },
        theme: { color: '#4f46e5' },
        handler: (response) => handlePaymentResponse(response, data.shopKartOrderId),
        modal: {
          // Closing the modal abandons the payment. Say so plainly rather than
          // leaving the customer wondering, and keep the cart intact.
          ondismiss: () => {
            setPhase('idle');
            busyRef.current = false;
            setError('Payment was cancelled. Your cart has been saved.');
          },
        },
      });

      paymentObject.on('payment.failed', (response) => {
        setPhase('idle');
        busyRef.current = false;
        setError(
          response?.error?.description ||
            'Payment failed. Your cart has not been cleared. Please try again.'
        );
      });

      paymentObject.open();
    } catch (err) {
      setPhase('idle');
      busyRef.current = false;
      setError(err.response?.data?.message || 'Could not start the payment. Please try again.');
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return; // no API call at all

    const shippingAddress = { ...form };
    shippingAddress.phone = shippingAddress.phone
      .replace(/[\s-]/g, '')
      .replace(/^(\+91|91)/, '');
    await handlePlaceOrder(shippingAddress);
  };

  const submitting = phase !== 'idle';

  if (loading) {
    return (
      <div className="page wide-page">
        <h2>Checkout</h2>
        <p className="muted">Loading your cart...</p>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="page">
        <div className="form wide">
          <h2>Checkout</h2>
          <div className="empty-state">
            <p>Your cart is empty - add something before checking out.</p>
            <Link className="btn" to="/products">
              Browse products
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page wide-page">
      <Link className="back-link" to="/cart">
        &larr; Back to Cart
      </Link>
      <h2>Checkout</h2>

      <div className="checkout">
        <form className="form" onSubmit={submit} noValidate>
          <h3>Shipping details</h3>

          {error && <p className="error">{error}</p>}

          {FIELDS.map((field) => (
            <label key={field.name}>
              {field.label}
              <input
                name={field.name}
                type={field.type}
                value={form[field.name]}
                onChange={handleChange}
                placeholder={field.placeholder}
                className={fieldErrors[field.name] ? 'invalid' : ''}
              />
              {fieldErrors[field.name] && (
                <span className="field-error">{fieldErrors[field.name]}</span>
              )}
            </label>
          ))}

          <button className="btn" type="submit" disabled={submitting}>
            {phase === 'creating'
              ? 'Creating order...'
              : phase === 'verifying'
                ? 'Verifying payment...'
                : `Pay ${formatPrice(subtotal)}`}
          </button>

          <p className="muted small">
            <strong>How payment works:</strong> we create the order on our server, Razorpay handles
            the payment in Test Mode, then our server verifies the signature before your cart is
            cleared.
          </p>
        </form>

        <div className="panel order-review">
          <h3>Order summary ({totalUnits} items)</h3>
          <ul>
            {cartItems.map((item) => (
              <li key={item.product._id}>
                <img src={item.product.image} alt="" />
                <span>
                  {item.product.name} x {item.quantity}
                </span>
                <strong>{formatPrice(item.product.price * item.quantity)}</strong>
              </li>
            ))}
          </ul>
          <p className="price big">
            Subtotal: <strong>{formatPrice(subtotal)}</strong>
          </p>
          <p className="muted small">
            The final amount is re-checked against live prices on the server - this summary is for
            reference only.
          </p>
        </div>
      </div>
    </div>
  );
}