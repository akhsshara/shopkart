import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchProfile } from '../services/api';

// Protected: fetches GET /customers/me; redirects to /login if 401.
export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetchProfile();
        if (active) setUser(res.data);
      } catch {
        navigate('/login'); // not logged in -> redirect
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  if (loading) return <div className="page"><p>Loading profile...</p></div>;
  if (!user) return null;

  return (
    <div className="page">
      <div className="form wide">
        <h2>Welcome, {user.fullName}!</h2>
        <p><strong>Name:</strong> {user.fullName}</p>
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>Phone:</strong> {user.phone}</p>
        <Link className="btn" to="/products">Browse Products</Link>
      </div>
    </div>
  );
}
