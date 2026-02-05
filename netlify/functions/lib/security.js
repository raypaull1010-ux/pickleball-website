// Security utilities for Netlify Functions
//
// Provides:
// - Input sanitization
// - Rate limiting
// - Request validation

// ============================================
// INPUT SANITIZATION
// ============================================

// Basic HTML entity encoding to prevent XSS
function sanitizeString(str) {
  if (typeof str !== 'string') return str;

  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Sanitize an object recursively
function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[sanitizeString(key)] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
}

// Validate email format
function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate URL format
function isValidUrl(url) {
  if (typeof url !== 'string') return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Validate phone number (basic)
function isValidPhone(phone) {
  if (typeof phone !== 'string') return false;
  // Remove common separators and check for 10+ digits
  const digits = phone.replace(/[\s\-\(\)\.]/g, '');
  return /^\+?\d{10,15}$/.test(digits);
}

// ============================================
// RATE LIMITING
// ============================================

// Simple in-memory rate limiter
// Note: This resets when function cold starts. For production,
// consider using Redis or a database for persistent rate limiting.

const rateLimitStore = new Map();

// Clean up old entries periodically
function cleanupRateLimiter() {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now - data.windowStart > data.windowMs * 2) {
      rateLimitStore.delete(key);
    }
  }
}

// Rate limit configuration per endpoint
const RATE_LIMITS = {
  default: { maxRequests: 100, windowMs: 60000 }, // 100 req/min
  'video-submission': { maxRequests: 10, windowMs: 60000 }, // 10 req/min
  'membership': { maxRequests: 10, windowMs: 60000 }, // 10 req/min
  'instructor': { maxRequests: 20, windowMs: 60000 }, // 20 req/min
  'create-checkout': { maxRequests: 10, windowMs: 60000 }, // 10 req/min
  'analyze-video': { maxRequests: 5, windowMs: 60000 } // 5 req/min (expensive)
};

// Check rate limit for an IP/endpoint combination
function checkRateLimit(ip, endpoint = 'default') {
  cleanupRateLimiter();

  const config = RATE_LIMITS[endpoint] || RATE_LIMITS.default;
  const key = `${ip}:${endpoint}`;
  const now = Date.now();

  let data = rateLimitStore.get(key);

  if (!data) {
    data = {
      count: 0,
      windowStart: now,
      windowMs: config.windowMs
    };
    rateLimitStore.set(key, data);
  }

  // Reset window if expired
  if (now - data.windowStart >= config.windowMs) {
    data.count = 0;
    data.windowStart = now;
  }

  data.count++;

  if (data.count > config.maxRequests) {
    const retryAfter = Math.ceil((data.windowStart + config.windowMs - now) / 1000);
    return {
      allowed: false,
      retryAfter,
      remaining: 0
    };
  }

  return {
    allowed: true,
    remaining: config.maxRequests - data.count,
    retryAfter: 0
  };
}

// Get client IP from Netlify request
function getClientIp(event) {
  // Netlify provides client IP in headers
  return event.headers['x-nf-client-connection-ip'] ||
         event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         event.headers['client-ip'] ||
         'unknown';
}

// ============================================
// REQUEST VALIDATION
// ============================================

// Validate required fields
function validateRequired(body, requiredFields) {
  const missing = [];

  for (const field of requiredFields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    return {
      valid: false,
      error: `Missing required fields: ${missing.join(', ')}`
    };
  }

  return { valid: true };
}

// Validate field types
function validateTypes(body, typeSpec) {
  const errors = [];

  for (const [field, expectedType] of Object.entries(typeSpec)) {
    if (body[field] !== undefined) {
      const actualType = typeof body[field];

      if (expectedType === 'email') {
        if (!isValidEmail(body[field])) {
          errors.push(`${field} must be a valid email address`);
        }
      } else if (expectedType === 'url') {
        if (!isValidUrl(body[field])) {
          errors.push(`${field} must be a valid URL`);
        }
      } else if (expectedType === 'phone') {
        if (!isValidPhone(body[field])) {
          errors.push(`${field} must be a valid phone number`);
        }
      } else if (actualType !== expectedType) {
        errors.push(`${field} must be a ${expectedType}`);
      }
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      error: errors.join('; ')
    };
  }

  return { valid: true };
}

// ============================================
// MIDDLEWARE HELPER
// ============================================

// Apply security checks to a handler
function withSecurity(handler, options = {}) {
  const {
    rateLimit = true,
    sanitize = true,
    endpoint = 'default'
  } = options;

  return async (event, context) => {
    // Rate limiting
    if (rateLimit) {
      const ip = getClientIp(event);
      const limit = checkRateLimit(ip, endpoint);

      if (!limit.allowed) {
        return {
          statusCode: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': limit.retryAfter.toString(),
            'X-RateLimit-Remaining': '0',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            error: 'Too many requests',
            retryAfter: limit.retryAfter
          })
        };
      }
    }

    // Parse and sanitize body
    if (event.body && sanitize) {
      try {
        const parsed = JSON.parse(event.body);
        event.body = JSON.stringify(sanitizeObject(parsed));
      } catch (e) {
        // Body might not be JSON, that's ok
      }
    }

    // Call the actual handler
    return handler(event, context);
  };
}

module.exports = {
  sanitizeString,
  sanitizeObject,
  isValidEmail,
  isValidUrl,
  isValidPhone,
  checkRateLimit,
  getClientIp,
  validateRequired,
  validateTypes,
  withSecurity
};
