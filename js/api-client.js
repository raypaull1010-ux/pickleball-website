// ============================================
// Ray's Pickleball - API Client
// ============================================
// Shared utility for making API calls from forms
// Handles: authentication, errors, loading states, Stripe checkout

const API = {
  // Base URL for API endpoints
  baseUrl: '/.netlify/functions',

  // Get auth token if user is logged in
  getAuthToken: async function() {
    if (typeof getSupabaseClient === 'function') {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          return session.access_token;
        }
      }
    }
    return null;
  },

  // Make API request
  request: async function(endpoint, options = {}) {
    const {
      method = 'GET',
      body = null,
      requireAuth = false
    } = options;

    const headers = {
      'Content-Type': 'application/json'
    };

    // Add auth header if available or required
    const token = await this.getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else if (requireAuth) {
      throw new Error('Authentication required. Please log in.');
    }

    const fetchOptions = {
      method,
      headers
    };

    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, fetchOptions);

    // Parse response
    let data;
    try {
      data = await response.json();
    } catch (e) {
      data = { error: 'Invalid response from server' };
    }

    if (!response.ok) {
      throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
    }

    return data;
  },

  // ============================================
  // VIDEO SUBMISSION
  // ============================================
  submitVideo: async function(formData) {
    return this.request('/api/video-submission', {
      method: 'POST',
      body: formData
    });
  },

  // ============================================
  // MEMBERSHIP
  // ============================================
  submitMembership: async function(formData) {
    return this.request('/api/membership', {
      method: 'POST',
      body: formData
    });
  },

  getMembership: async function() {
    return this.request('/api/membership', {
      method: 'GET',
      requireAuth: true
    });
  },

  // ============================================
  // INSTRUCTOR
  // ============================================
  submitInstructor: async function(formData) {
    return this.request('/api/instructor', {
      method: 'POST',
      body: formData
    });
  },

  getInstructors: async function() {
    return this.request('/api/instructor', {
      method: 'GET'
    });
  },

  // ============================================
  // STRIPE CHECKOUT
  // ============================================
  createCheckout: async function(options) {
    const {
      productType,  // 'video_30', 'video_60', 'membership_monthly', etc.
      itemId,       // ID from submission API
      customerEmail,
      customerName,
      metadata = {}
    } = options;

    const response = await this.request('/create-checkout', {
      method: 'POST',
      body: {
        productType,
        itemId,
        customerEmail,
        customerName,
        metadata
      }
    });

    // Redirect to Stripe Checkout
    if (response.url) {
      window.location.href = response.url;
    } else {
      throw new Error('Failed to create checkout session');
    }

    return response;
  },

  // ============================================
  // VIDEO ANALYSIS
  // ============================================
  analyzeVideo: async function(videoUrl, drillType, focusArea) {
    return this.request('/analyze-video', {
      method: 'POST',
      body: {
        videoUrl,
        drillType,
        focusArea
      }
    });
  }
};

// ============================================
// FORM HELPERS
// ============================================

const FormHelpers = {
  // Show loading state on a button
  setLoading: function(button, isLoading, originalText = null) {
    if (isLoading) {
      button.dataset.originalText = button.textContent;
      button.textContent = 'Processing...';
      button.disabled = true;
      button.classList.add('loading');
    } else {
      button.textContent = originalText || button.dataset.originalText || 'Submit';
      button.disabled = false;
      button.classList.remove('loading');
    }
  },

  // Show error message
  showError: function(container, message) {
    // Remove existing error
    const existing = container.querySelector('.form-error');
    if (existing) existing.remove();

    const errorDiv = document.createElement('div');
    errorDiv.className = 'form-error';
    errorDiv.style.cssText = 'background: #fef2f2; color: #dc2626; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px;';
    errorDiv.textContent = message;
    container.insertBefore(errorDiv, container.firstChild);

    // Auto-remove after 10 seconds
    setTimeout(() => errorDiv.remove(), 10000);
  },

  // Show success message
  showSuccess: function(container, message) {
    // Remove existing messages
    const existing = container.querySelector('.form-success');
    if (existing) existing.remove();

    const successDiv = document.createElement('div');
    successDiv.className = 'form-success';
    successDiv.style.cssText = 'background: #f0fdf4; color: #16a34a; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px;';
    successDiv.textContent = message;
    container.insertBefore(successDiv, container.firstChild);
  },

  // Validate email
  isValidEmail: function(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  // Validate URL
  isValidUrl: function(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  // Get form data as object
  getFormData: function(form) {
    const formData = new FormData(form);
    const data = {};
    for (const [key, value] of formData.entries()) {
      data[key] = value;
    }
    return data;
  },

  // Store order info for success page
  storeOrderInfo: function(orderData) {
    localStorage.setItem('recentOrder', JSON.stringify({
      ...orderData,
      timestamp: Date.now()
    }));
  }
};

// ============================================
// PAYMENT METHOD SELECTOR
// ============================================

function createPaymentSelector(options = {}) {
  const {
    containerId,
    onStripeClick,
    onVenmoClick,
    stripeAmount,
    venmoHandle = '@Ray-Paull'
  } = options;

  const container = document.getElementById(containerId);
  if (!container) return;

  const html = `
    <div class="payment-selector" style="margin-top: 24px;">
      <h3 style="margin-bottom: 16px; font-size: 18px;">Choose Payment Method</h3>

      <div class="payment-options" style="display: flex; gap: 16px; flex-wrap: wrap;">
        <!-- Stripe Option -->
        <button type="button" class="btn btn-primary payment-btn stripe-btn" style="flex: 1; min-width: 200px; padding: 16px;">
          <span style="display: block; font-size: 16px; font-weight: 600;">💳 Pay with Card</span>
          <span style="display: block; font-size: 14px; opacity: 0.9; margin-top: 4px;">${stripeAmount || 'Secure checkout'}</span>
        </button>

        <!-- Venmo Option -->
        <button type="button" class="btn btn-secondary payment-btn venmo-btn" style="flex: 1; min-width: 200px; padding: 16px; background: #008CFF; border-color: #008CFF;">
          <span style="display: block; font-size: 16px; font-weight: 600;">📱 Pay with Venmo</span>
          <span style="display: block; font-size: 14px; opacity: 0.9; margin-top: 4px;">${venmoHandle}</span>
        </button>
      </div>

      <p style="margin-top: 12px; font-size: 13px; color: #6b7280; text-align: center;">
        Secure payment processing. Your data is encrypted.
      </p>
    </div>
  `;

  container.innerHTML = html;

  // Add event listeners
  const stripeBtn = container.querySelector('.stripe-btn');
  const venmoBtn = container.querySelector('.venmo-btn');

  if (stripeBtn && onStripeClick) {
    stripeBtn.addEventListener('click', onStripeClick);
  }

  if (venmoBtn && onVenmoClick) {
    venmoBtn.addEventListener('click', onVenmoClick);
  }

  return { stripeBtn, venmoBtn };
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { API, FormHelpers, createPaymentSelector };
}
