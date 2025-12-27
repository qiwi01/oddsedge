import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect, createContext, useContext } from 'react';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import api from './utils/api';

// Contexts
import { ThemeProvider } from './contexts/ThemeContext';

// Components
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Predictions from './pages/Predictions';
import Profile from './pages/Profile';
import VIP from './pages/VIP';
import BetConverter from './pages/BetConverter';
import Admin from './pages/Admin';
import AdminLogin from './pages/AdminLogin';
import Login from './pages/Login';
import Register from './pages/Register';
import Outcomes from './pages/Outcomes';

// Protected Route Component
function ProtectedRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    // Redirect to login with the current location as state
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

// Auth Context
const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

function AppContent() {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if current path is admin-related
  const isAdminPath = location.pathname.startsWith('/admin');

  useEffect(() => {
    // Only run authentication check in browser environment
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (token) {
      // Verify token and get user data
      api.get('/api/auth/profile')
        .then(res => {
          setUser(res.data);
        })
        .catch(() => {
          localStorage.removeItem('token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    setUser(userData);
    toast.success('Logged in successfully!');
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    toast.success('Logged out successfully!');
  };

  const register = (token, userData) => {
    localStorage.setItem('token', token);
    setUser(userData);
    toast.success('Account created successfully!');
  };

  if (loading) {
    return (
      <div className="predictions-loading">
        <div className="predictions-loading-spinner"></div>
        <div className="predictions-loading-text">
          <div className="predictions-loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
          Initializing application...
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, register }}>
      <div className="app-container">
        {!isAdminPath && <Navbar />}
        <main className="app-main">
          <Routes>
            {/* Home page - accessible without authentication */}
            <Route path="/" element={<Home />} />

            {/* All other routes require authentication */}
            <Route path="/predictions" element={
              <ProtectedRoute>
                <Predictions />
              </ProtectedRoute>
            } />

            {/* Top Picks */}
            <Route path="/predictions/top-picks" element={
              <ProtectedRoute>
                <Predictions />
              </ProtectedRoute>
            } />
            <Route path="/predictions/top-picks/win" element={
              <ProtectedRoute>
                <Predictions />
              </ProtectedRoute>
            } />
            <Route path="/predictions/top-picks/over15" element={
              <ProtectedRoute>
                <Predictions />
              </ProtectedRoute>
            } />
            <Route path="/predictions/top-picks/over25" element={
              <ProtectedRoute>
                <Predictions />
              </ProtectedRoute>
            } />
            <Route path="/predictions/top-picks/over35" element={
              <ProtectedRoute>
                <Predictions />
              </ProtectedRoute>
            } />
            <Route path="/predictions/top-picks/players" element={
              <ProtectedRoute>
                <Predictions />
              </ProtectedRoute>
            } />

            {/* VIP */}
            <Route path="/predictions/vip" element={
              <ProtectedRoute>
                <Predictions />
              </ProtectedRoute>
            } />

            {/* Today's Predictions */}
            <Route path="/predictions/today/win" element={
              <ProtectedRoute>
                <Predictions />
              </ProtectedRoute>
            } />
            <Route path="/predictions/today/over15" element={
              <ProtectedRoute>
                <Predictions />
              </ProtectedRoute>
            } />
            <Route path="/predictions/today/over25" element={
              <ProtectedRoute>
                <Predictions />
              </ProtectedRoute>
            } />
            <Route path="/predictions/today/over35" element={
              <ProtectedRoute>
                <Predictions />
              </ProtectedRoute>
            } />
            <Route path="/predictions/today/players" element={
              <ProtectedRoute>
                <Predictions />
              </ProtectedRoute>
            } />

            {/* All Predictions */}
            <Route path="/predictions/win" element={
              <ProtectedRoute>
                <Predictions />
              </ProtectedRoute>
            } />
            <Route path="/predictions/over15" element={
              <ProtectedRoute>
                <Predictions />
              </ProtectedRoute>
            } />
            <Route path="/predictions/over25" element={
              <ProtectedRoute>
                <Predictions />
              </ProtectedRoute>
            } />
            <Route path="/predictions/over35" element={
              <ProtectedRoute>
                <Predictions />
              </ProtectedRoute>
            } />
            <Route path="/predictions/players" element={
              <ProtectedRoute>
                <Predictions />
              </ProtectedRoute>
            } />

            {/* Profile - requires authentication */}
            <Route path="/profile" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />

            {/* Admin routes */}
            <Route
              path="/admin"
              element={!user ? <AdminLogin /> : (user.role === 'admin' ? <Navigate to="/admin/dashboard" /> : <Navigate to="/" />)}
            />
            <Route
              path="/admin/dashboard"
              element={user?.role === 'admin' ? <Admin /> : <Navigate to="/admin" />}
            />

            {/* Auth routes - accessible without authentication */}
            <Route
              path="/login"
              element={!user ? <Login /> : <Navigate to="/" />}
            />
            <Route
              path="/register"
              element={!user ? <Register /> : <Navigate to="/" />}
            />

            {/* VIP and Outcomes - require authentication */}
            <Route path="/vip" element={
              <ProtectedRoute>
                <VIP />
              </ProtectedRoute>
            } />
            <Route path="/vip/converter" element={
              <ProtectedRoute>
                <BetConverter />
              </ProtectedRoute>
            } />
            <Route path="/outcomes" element={
              <ProtectedRoute>
                <Outcomes />
              </ProtectedRoute>
            } />
          </Routes>
        </main>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1e293b',
              color: '#fff',
              border: '1px solid #334155',
            },
          }}
        />
      </div>
    </AuthContext.Provider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <Router>
        <AppContent />
      </Router>
    </ThemeProvider>
  );
}

export default App;
