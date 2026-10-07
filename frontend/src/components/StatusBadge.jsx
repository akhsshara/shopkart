const STATUS_CLASS = {
  PENDING_PAYMENT: 'badge-pending',
  PLACED: 'badge-placed',
  CONFIRMED: 'badge-confirmed',
  SHIPPED: 'badge-shipped',
  DELIVERED: 'badge-delivered',
};

const PAYMENT_CLASS = {
  PENDING: 'badge-pending',
  PAID: 'badge-paid',
  FAILED: 'badge-failed',
};

// Small presentational badge for order status + payment status.
export default function StatusBadge({ status, paymentStatus }) {
  return (
    <p className="badges">
      <span className={`badge ${STATUS_CLASS[status] || 'badge-pending'}`}>
        {String(status || '').replace(/_/g, ' ')}
      </span>
      {paymentStatus && (
        <span className={`badge ${PAYMENT_CLASS[paymentStatus] || 'badge-pending'}`}>
          Payment: {paymentStatus}
        </span>
      )}
    </p>
  );
}