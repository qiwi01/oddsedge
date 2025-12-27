import { useState, useEffect } from 'react';
import { useAuth } from '../App';
import toast from 'react-hot-toast';
import { Star, Crown, CheckCircle, CreditCard, Lock, TrendingUp, Users, Zap } from 'lucide-react';
import api from '../utils/api';
import '../css/VIP.css';

const VIP = () => {
  const { user } = useAuth();
  const [vipStatus, setVipStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);

  useEffect(() => {
    if (user) {
      checkVIPStatus();
    }
  }, [user]);

  const checkVIPStatus = async () => {
    try {
      const response = await api.get('/api/vip/status');
      setVipStatus(response.data);
    } catch (error) {
      // Error handled silently
    }
  };

  const [selectedPlan, setSelectedPlan] = useState('yearly');

  const handleVIPPayment = async () => {
    if (!user) {
      toast.error('Please login to subscribe to VIP');
      return;
    }

    setPaymentLoading(true);
    try {
      const response = await api.post('/api/vip/initialize-payment', {
        plan: selectedPlan
      });

      // Redirect to Paystack payment page
      window.location.href = response.data.data.authorization_url;
    } catch (error) {
      toast.error('Failed to initialize payment. Please try again.');
    } finally {
      setPaymentLoading(false);
    }
  };

  // If user is already VIP, show VIP dashboard
  if (vipStatus?.isVIP) {
    return (
      <div className="vip-container">
        <div className="vip-header">
          <div className="vip-header-content">
            <Crown className="vip-header-icon" />
            <div>
              <h1 className="vip-title">VIP Member Dashboard</h1>
              <p className="vip-subtitle">
                Welcome to your exclusive VIP experience! Access premium predictions and advanced features.
              </p>
              {vipStatus.vipExpiry && (
                <p className="vip-expiry">
                  VIP Status expires: {new Date(vipStatus.vipExpiry).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="vip-features">
          <div className="vip-feature-grid">
            <div className="vip-feature-card">
              <Star className="vip-feature-icon" />
              <h3 className="vip-feature-title">VIP Predictions</h3>
              <p className="vip-feature-description">
                Access exclusive VIP-only predictions with higher accuracy algorithms
              </p>
            </div>

            <div className="vip-feature-card">
              <Zap className="vip-feature-icon" />
              <h3 className="vip-feature-title">Bet Code Converter</h3>
              <p className="vip-feature-description">
                Advanced bet code conversion tools for multiple betting platforms
              </p>
            </div>

            <div className="vip-feature-card">
              <TrendingUp className="vip-feature-icon" />
              <h3 className="vip-feature-title">Premium Analytics</h3>
              <p className="vip-feature-description">
                Detailed performance analytics and profit tracking tools
              </p>
            </div>

            <div className="vip-feature-card">
              <Users className="vip-feature-icon" />
              <h3 className="vip-feature-title">Priority Support</h3>
              <p className="vip-feature-description">
                Direct access to our expert prediction team for personalized advice
              </p>
            </div>
          </div>
        </div>

        <div className="vip-actions">
          <a href="/predictions/vip" className="vip-action-btn primary">
            <Star className="vip-action-icon" />
            View VIP Predictions
          </a>
          <a href="/vip/converter" className="vip-action-btn secondary">
            <TrendingUp className="vip-action-icon" />
            Bet Code Converter
          </a>
        </div>
      </div>
    );
  }

  // Non-VIP user sees subscription page
  return (
    <div className="vip-container">
      <div className="vip-header">
        <div className="vip-header-content">
          <Crown className="vip-header-icon" />
          <div>
            <h1 className="vip-title">Unlock VIP Access</h1>
            <p className="vip-subtitle">
              Join thousands of successful bettors who trust our premium predictions
            </p>
          </div>
        </div>
      </div>

      <div className="vip-pricing">
        <div className="vip-pricing-plans">
          {/* Monthly Plan */}
          <div className={`vip-pricing-card ${selectedPlan === 'monthly' ? 'selected' : ''}`}>
            <div className="vip-pricing-header">
              <Crown className="vip-pricing-icon" />
              <h2 className="vip-pricing-title">Monthly VIP</h2>
              <div className="vip-pricing-price">
                <span className="vip-price-amount">₦5,000</span>
                <span className="vip-price-period">/ month</span>
              </div>
            </div>

            <div className="vip-pricing-features">
              <div className="vip-feature-item">
                <CheckCircle className="vip-feature-check" />
                <span>Access to VIP-only predictions</span>
              </div>
              <div className="vip-feature-item">
                <CheckCircle className="vip-feature-check" />
                <span>Advanced bet code converter</span>
              </div>
              <div className="vip-feature-item">
                <CheckCircle className="vip-feature-check" />
                <span>Premium analytics dashboard</span>
              </div>
              <div className="vip-feature-item">
                <CheckCircle className="vip-feature-check" />
                <span>Priority customer support</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedPlan('monthly')}
              className={`vip-plan-select-btn ${selectedPlan === 'monthly' ? 'active' : ''}`}
            >
              {selectedPlan === 'monthly' ? 'Selected' : 'Select Monthly'}
            </button>
          </div>

          {/* Yearly Plan */}
          <div className={`vip-pricing-card ${selectedPlan === 'yearly' ? 'selected' : ''}`}>
            <div className="vip-pricing-header">
              <Crown className="vip-pricing-icon" />
              <h2 className="vip-pricing-title">Yearly VIP</h2>
              <div className="vip-pricing-price">
                <span className="vip-price-amount">₦50,000</span>
                <span className="vip-price-period">/ year</span>
                <span className="vip-price-save">Save ₦10,000</span>
              </div>
            </div>

            <div className="vip-pricing-features">
              <div className="vip-feature-item">
                <CheckCircle className="vip-feature-check" />
                <span>All Monthly features</span>
              </div>
              <div className="vip-feature-item">
                <CheckCircle className="vip-feature-check" />
                <span>Early access to new features</span>
              </div>
              <div className="vip-feature-item">
                <CheckCircle className="vip-feature-check" />
                <span>1-year membership validity</span>
              </div>
              <div className="vip-feature-item">
                <CheckCircle className="vip-feature-check" />
                <span>Best value option</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedPlan('yearly')}
              className={`vip-plan-select-btn ${selectedPlan === 'yearly' ? 'active' : ''}`}
            >
              {selectedPlan === 'yearly' ? 'Selected' : 'Select Yearly'}
            </button>
          </div>
        </div>

        <div className="vip-pricing-benefits">
          <h3 className="vip-benefits-title">VIP Benefits</h3>
          <div className="vip-benefits-grid">
            <div className="vip-benefit">
              <div className="vip-benefit-stat">95%</div>
              <div className="vip-benefit-label">Prediction Accuracy</div>
            </div>
            <div className="vip-benefit">
              <div className="vip-benefit-stat">24/7</div>
              <div className="vip-benefit-label">Expert Support</div>
            </div>
            <div className="vip-benefit">
              <div className="vip-benefit-stat">500+</div>
              <div className="vip-benefit-label">Monthly Predictions</div>
            </div>
          </div>
        </div>

        <button
          onClick={handleVIPPayment}
          disabled={paymentLoading}
          className="vip-subscribe-btn"
        >
          {paymentLoading ? (
            <>
              <div className="vip-loading-spinner"></div>
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="vip-subscribe-icon" />
              Subscribe to VIP - ₦{selectedPlan === 'monthly' ? '5,000' : '50,000'}
            </>
          )}
        </button>

        <div className="vip-security-note">
          <Lock className="vip-security-icon" />
          <span>Secure payment powered by Paystack</span>
        </div>
      </div>

      <div className="vip-testimonials">
        <h2 className="vip-testimonials-title">What Our VIP Members Say</h2>
        <div className="vip-testimonials-grid">
          <div className="vip-testimonial">
            <div className="vip-testimonial-content">
              "The VIP predictions have completely changed my betting game. I'm now consistently profitable!"
            </div>
            <div className="vip-testimonial-author">
              <span className="vip-author-name">Adebayo Johnson</span>
              <span className="vip-author-badge">VIP Member</span>
            </div>
          </div>

          <div className="vip-testimonial">
            <div className="vip-testimonial-content">
              "The bet code converter saves me so much time. Worth every penny!"
            </div>
            <div className="vip-testimonial-author">
              <span className="vip-author-name">Ngozi Okoro</span>
              <span className="vip-author-badge">VIP Member</span>
            </div>
          </div>

          <div className="vip-testimonial">
            <div className="vip-testimonial-content">
              "Customer support is amazing. They respond within minutes and are incredibly helpful."
            </div>
            <div className="vip-testimonial-author">
              <span className="vip-author-name">Chukwuemeka Nwosu</span>
              <span className="vip-author-badge">VIP Member</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VIP;
