/**
 * Shared Utility Functions
 * Centralized utilities used across the application
 */

const Utils = {
    /**
     * Format a date string as relative time (e.g., "5m ago", "2h ago")
     * @param {string|Date} dateStr - The date to format
     * @returns {string} Formatted relative time string
     */
    formatTimeAgo(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);

        if (seconds < 0) return 'just now';
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
        if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`;

        return date.toLocaleDateString();
    },

    /**
     * Format a number with K/M suffix for large numbers
     * @param {number} num - The number to format
     * @returns {string} Formatted number string
     */
    formatNumber(num) {
        if (num === null || num === undefined) return '0';
        num = Number(num);
        if (isNaN(num)) return '0';

        if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        return num.toString();
    },

    /**
     * Escape HTML special characters to prevent XSS
     * @param {string} str - The string to escape
     * @returns {string} Escaped string safe for HTML insertion
     */
    escapeHtml(str) {
        if (!str) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return String(str).replace(/[&<>"']/g, c => map[c]);
    },

    /**
     * Format a date for display (e.g., "Jan 15, 2024")
     * @param {string|Date} dateStr - The date to format
     * @returns {string} Formatted date string
     */
    formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    },

    /**
     * Format a date with time (e.g., "Jan 15, 2024 at 3:30 PM")
     * @param {string|Date} dateStr - The date to format
     * @returns {string} Formatted date and time string
     */
    formatDateTime(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    },

    /**
     * Debounce a function call
     * @param {Function} func - The function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Generate a simple unique ID
     * @param {string} prefix - Optional prefix for the ID
     * @returns {string} Unique identifier
     */
    generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Check if a string is a valid email
     * @param {string} email - The email to validate
     * @returns {boolean} True if valid email format
     */
    isValidEmail(email) {
        if (!email) return false;
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    /**
     * Capitalize the first letter of a string
     * @param {string} str - The string to capitalize
     * @returns {string} Capitalized string
     */
    capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    },

    /**
     * Truncate a string to a maximum length with ellipsis
     * @param {string} str - The string to truncate
     * @param {number} maxLength - Maximum length before truncation
     * @returns {string} Truncated string
     */
    truncate(str, maxLength = 100) {
        if (!str || str.length <= maxLength) return str || '';
        return str.substring(0, maxLength - 3) + '...';
    },

    /**
     * Deep clone an object
     * @param {Object} obj - The object to clone
     * @returns {Object} Cloned object
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        return JSON.parse(JSON.stringify(obj));
    },

    /**
     * Check if running on mobile device
     * @returns {boolean} True if on mobile device
     */
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },

    /**
     * Get ordinal suffix for a number (1st, 2nd, 3rd, etc.)
     * @param {number} n - The number
     * @returns {string} Number with ordinal suffix
     */
    getOrdinal(n) {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }
};

// Make Utils available globally
if (typeof window !== 'undefined') {
    window.Utils = Utils;
}
