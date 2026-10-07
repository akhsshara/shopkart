import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { getApiErrorMessage } from '../services/api';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const validate = () => {
    if (!form.fullName.trim() || !form.email.trim() || !form.password || !form.phone.trim()) {
      return 'All fields are required';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Invalid email format';
    if (form.password.length < 6) return 'Password must be at least 6 characters';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }
    setLoading(true);
    try {
      await api.post('/customers/register', {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim(),
      });
      navigate('/login'); // success -> login
    } catch (err) {
      setError(getApiErrorMessage(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <form className="form" onSubmit={handleSubmit}>
        <h2>Create Account</h2>
        {error && <p className="error">{error}</p>}
        <label>
          Full Name
          <input name="fullName" value={form.fullName} onChange={handleChange} placeholder="John Doe" />
        </label>
        <label>
          Email
          <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="john@gmail.com" />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Min 6 characters"
          />
        </label>
        <label>
          Phone Number
          <input name="phone" value={form.phone} onChange={handleChange} placeholder="9876543210" />
        </label>
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Account'}
        </button>
        <p className="muted">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}
