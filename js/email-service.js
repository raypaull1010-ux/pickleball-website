/**
 * Email Service Module
 * Centralized email handling for Ray's Pickleball website
 * Uses EmailJS for client-side email sending
 */

const EmailService = (function() {
    // ============================================
    // CONFIGURATION
    // ============================================
    const CONFIG = {
        PUBLIC_KEY: 'ZNybZzCj9oYiFl2L8',
        SERVICE_ID: 'service_akkzy4p',
        ADMIN_EMAIL: 'raypaull1010@gmail.com',

        // Template IDs - must match EmailJS dashboard
        TEMPLATES: {
            // Video Analysis
            VIDEO_CUSTOMER_RECEIVED: 'video_customer_received',
            VIDEO_ADMIN_NOTIFICATION: 'video_admin_notification',
            VIDEO_PAYMENT_CONFIRMED: 'video_payment_confirmed',

            // Membership
            MEMBERSHIP_CUSTOMER_RECEIVED: 'membership_customer_received',
            MEMBERSHIP_ADMIN_NOTIFICATION: 'membership_admin_notification',
            MEMBERSHIP_PAYMENT_CONFIRMED: 'membership_payment_confirmed',

            // Referral Program
            REFERRAL_PENDING: 'referral_pending',
            REFERRAL_CONFIRMED: 'referral_confirmed',
            REWARD_UNLOCKED: 'reward_unlocked',
            REWARD_CLAIMED: 'reward_claimed',
            AMBASSADOR_ACHIEVED: 'ambassador_achieved',

            // Instructor Network
            INSTRUCTOR_WELCOME: 'instructor_welcome',
            INSTRUCTOR_APPROVED: 'instructor_approved',
            INSTRUCTOR_REFERRAL_UPDATE: 'instructor_referral_update',
            INSTRUCTOR_GRACE_ENDING: 'instructor_grace_ending',
            INSTRUCTOR_PAUSED: 'instructor_paused',
            INSTRUCTOR_REACTIVATED: 'instructor_reactivated',

            // Skill Evaluations
            EVALUATION_RECEIVED: 'evaluation_received',
            EVALUATION_COMPLETE: 'evaluation_complete'
        }
    };

    // ============================================
    // INITIALIZATION
    // ============================================
    function init() {
        if (typeof emailjs !== 'undefined') {
            emailjs.init(CONFIG.PUBLIC_KEY);
            console.log('EmailService initialized');
            return true;
        } else {
            console.warn('EmailJS SDK not loaded');
            return false;
        }
    }

    // ============================================
    // CORE EMAIL SENDING
    // ============================================
    async function send(templateId, params) {
        if (typeof emailjs === 'undefined') {
            console.error('EmailJS SDK not loaded');
            return { success: false, error: 'EmailJS not loaded' };
        }

        try {
            const response = await emailjs.send(
                CONFIG.SERVICE_ID,
                templateId,
                params
            );
            console.log(`Email sent successfully: ${templateId}`);
            return { success: true, response };
        } catch (error) {
            console.error(`Email send failed (${templateId}):`, error);
            return { success: false, error };
        }
    }

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    function generateId() {
        return 'sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    function formatDate(date) {
        return new Date(date).toLocaleString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    }

    function formatPrice(videoLength) {
        return videoLength === '60' ? '$120' : '$75';
    }

    function formatVideoLength(videoLength) {
        return videoLength === '60' ? '60 minutes' : '30 minutes';
    }

    function formatMembershipPrice(plan) {
        return plan === 'annual' ? '$199/year' : '$19.99/month';
    }

    function formatPlanType(plan) {
        return plan === 'annual' ? 'Annual' : 'Monthly';
    }

    // ============================================
    // VIDEO ANALYSIS EMAILS
    // ============================================

    /**
     * Send Stage 1 email to customer after video submission
     */
    async function sendVideoSubmissionReceived(data) {
        const params = {
            customer_name: data.name,
            customer_email: data.email,
            video_length: formatVideoLength(data.videoLength),
            price: formatPrice(data.videoLength),
            submitted_at: formatDate(new Date())
        };
        return send(CONFIG.TEMPLATES.VIDEO_CUSTOMER_RECEIVED, params);
    }

    /**
     * Send Stage 1 notification to admin about new submission
     */
    async function sendVideoAdminNotification(data) {
        const params = {
            customer_name: data.name,
            customer_email: data.email,
            customer_phone: data.phone || 'Not provided',
            video_link: data.videoLink,
            video_length: formatVideoLength(data.videoLength),
            price: formatPrice(data.videoLength),
            skill_level: data.skillLevel || 'Not specified',
            focus_areas: data.focusAreas || 'None specified',
            submitted_at: formatDate(new Date()),
            admin_email: CONFIG.ADMIN_EMAIL
        };
        return send(CONFIG.TEMPLATES.VIDEO_ADMIN_NOTIFICATION, params);
    }

    /**
     * Send Stage 2 email to customer after payment confirmed
     */
    async function sendVideoPaymentConfirmed(data) {
        const params = {
            customer_name: data.name,
            customer_email: data.email,
            video_length: formatVideoLength(data.videoLength),
            price: formatPrice(data.videoLength),
            turnaround: '48-72 hours'
        };
        return send(CONFIG.TEMPLATES.VIDEO_PAYMENT_CONFIRMED, params);
    }

    // ============================================
    // MEMBERSHIP EMAILS
    // ============================================

    /**
     * Send Stage 1 email to customer after membership request
     */
    async function sendMembershipReceived(data) {
        const params = {
            customer_name: data.name,
            customer_email: data.email,
            plan_type: formatPlanType(data.plan),
            price: formatMembershipPrice(data.plan),
            submitted_at: formatDate(new Date())
        };
        return send(CONFIG.TEMPLATES.MEMBERSHIP_CUSTOMER_RECEIVED, params);
    }

    /**
     * Send Stage 1 notification to admin about new membership request
     */
    async function sendMembershipAdminNotification(data) {
        const params = {
            customer_name: data.name,
            customer_email: data.email,
            plan_type: formatPlanType(data.plan),
            price: formatMembershipPrice(data.plan),
            submitted_at: formatDate(new Date()),
            admin_email: CONFIG.ADMIN_EMAIL
        };
        return send(CONFIG.TEMPLATES.MEMBERSHIP_ADMIN_NOTIFICATION, params);
    }

    /**
     * Send Stage 2 email to customer after membership payment confirmed
     */
    async function sendMembershipPaymentConfirmed(data) {
        const params = {
            customer_name: data.name,
            customer_email: data.email,
            plan_type: formatPlanType(data.plan),
            price: formatMembershipPrice(data.plan),
            benefits: [
                'Unlimited AI Drill Coach access',
                'Free Drill Playbook PDF',
                '20% off all video analysis',
                '20% off Session Tracker',
                'Weekly community contests',
                'Milestone rewards'
            ].join(', ')
        };
        return send(CONFIG.TEMPLATES.MEMBERSHIP_PAYMENT_CONFIRMED, params);
    }

    // ============================================
    // REFERRAL PROGRAM EMAILS
    // ============================================

    /**
     * Notify referrer that a friend signed up (pending 30-day confirmation)
     */
    async function sendReferralPending(data) {
        const params = {
            referrer_name: data.referrerName,
            referrer_email: data.referrerEmail,
            referred_name: data.referredName,
            confirms_at: formatDate(data.confirmsAt),
            days_until_confirm: 30
        };
        return send(CONFIG.TEMPLATES.REFERRAL_PENDING, params);
    }

    /**
     * Notify referrer that a referral has been confirmed (stayed 30 days)
     */
    async function sendReferralConfirmed(data) {
        const params = {
            referrer_name: data.referrerName,
            referrer_email: data.referrerEmail,
            referred_name: data.referredName,
            total_referrals: data.totalReferrals,
            current_cycle: data.currentCycle,
            next_tier: data.nextTier || 'Ambassador',
            referrals_to_next: data.referralsToNext || 0
        };
        return send(CONFIG.TEMPLATES.REFERRAL_CONFIRMED, params);
    }

    /**
     * Notify member that they've unlocked a reward tier
     */
    async function sendRewardUnlocked(data) {
        const params = {
            customer_name: data.name,
            customer_email: data.email,
            tier_level: data.tierLevel,
            reward_name: data.rewardName,
            reward_value: data.rewardValue || '',
            instructions: 'Contact Ray to claim your reward!'
        };
        return send(CONFIG.TEMPLATES.REWARD_UNLOCKED, params);
    }

    /**
     * Notify member that their reward has been marked as claimed by admin
     */
    async function sendRewardClaimed(data) {
        const params = {
            customer_name: data.name,
            customer_email: data.email,
            reward_name: data.reward
        };
        return send(CONFIG.TEMPLATES.REWARD_CLAIMED, params);
    }

    /**
     * Congratulate member on achieving LEGENDARY Ambassador status!
     */
    async function sendAmbassadorAchieved(data) {
        const params = {
            customer_name: data.name,
            customer_email: data.email,
            discount_percent: '10%',
            total_referrals: 15
        };
        return send(CONFIG.TEMPLATES.AMBASSADOR_ACHIEVED, params);
    }

    // ============================================
    // INSTRUCTOR NETWORK EMAILS
    // ============================================

    /**
     * Welcome email to new instructor after signup
     */
    async function sendInstructorWelcome(data) {
        const params = {
            instructor_name: data.name,
            instructor_email: data.email,
            referral_code: data.referralCode,
            grace_period_ends: data.gracePeriodEnds
        };
        return send(CONFIG.TEMPLATES.INSTRUCTOR_WELCOME, params);
    }

    /**
     * Notify instructor their profile is approved and live
     */
    async function sendInstructorApproved(data) {
        const params = {
            instructor_name: data.name,
            instructor_email: data.email,
            profile_url: 'https://rayspickleball.com/instructors.html'
        };
        return send(CONFIG.TEMPLATES.INSTRUCTOR_APPROVED, params);
    }

    /**
     * Monthly referral update to instructor
     */
    async function sendInstructorReferralUpdate(data) {
        const params = {
            instructor_name: data.name,
            instructor_email: data.email,
            current_month_referrals: data.currentMonthReferrals,
            referrals_needed: Math.max(0, 3 - data.currentMonthReferrals),
            total_referrals: data.totalReferrals,
            referral_code: data.referralCode
        };
        return send(CONFIG.TEMPLATES.INSTRUCTOR_REFERRAL_UPDATE, params);
    }

    /**
     * Warning email when grace period is ending soon
     */
    async function sendInstructorGraceEnding(data) {
        const params = {
            instructor_name: data.name,
            instructor_email: data.email,
            days_remaining: data.daysRemaining,
            grace_period_ends: data.gracePeriodEnds,
            current_referrals: data.currentReferrals
        };
        return send(CONFIG.TEMPLATES.INSTRUCTOR_GRACE_ENDING, params);
    }

    /**
     * Notification when instructor account is paused
     */
    async function sendInstructorPaused(data) {
        const params = {
            instructor_name: data.name,
            instructor_email: data.email,
            reason: data.reason || 'Referral requirement not met'
        };
        return send(CONFIG.TEMPLATES.INSTRUCTOR_PAUSED, params);
    }

    /**
     * Notification when instructor account is reactivated
     */
    async function sendInstructorReactivated(data) {
        const params = {
            instructor_name: data.name,
            instructor_email: data.email,
            reactivation_reason: data.reason || 'Account reactivated by admin'
        };
        return send(CONFIG.TEMPLATES.INSTRUCTOR_REACTIVATED, params);
    }

    // ============================================
    // SKILL EVALUATION EMAILS
    // ============================================

    /**
     * Confirmation email when skill evaluation is submitted
     */
    async function sendEvaluationReceived(data) {
        const params = {
            customer_name: data.name,
            customer_email: data.email,
            amount: data.amount || 35,
            payment_method: data.paymentMethod === 'venmo' ? 'Venmo' : 'Credit Card'
        };
        return send(CONFIG.TEMPLATES.EVALUATION_RECEIVED, params);
    }

    /**
     * Send completed evaluation results to customer
     */
    async function sendEvaluationComplete(data) {
        const params = {
            customer_name: data.name,
            customer_email: data.email,
            skill_level: data.level,
            evaluation_summary: data.summary
        };
        return send(CONFIG.TEMPLATES.EVALUATION_COMPLETE, params);
    }

    // ============================================
    // STORAGE HELPERS
    // ============================================

    /**
     * Store pending video submission
     */
    function storePendingVideoSubmission(data) {
        const submissions = JSON.parse(localStorage.getItem('pendingVideoSubmissions') || '[]');
        const submission = {
            id: generateId(),
            name: data.name,
            email: data.email,
            phone: data.phone || '',
            videoLink: data.videoLink,
            videoLength: data.videoLength,
            price: formatPrice(data.videoLength),
            skillLevel: data.skillLevel || '',
            focusAreas: data.focusAreas || '',
            submittedAt: new Date().toISOString(),
            stage1EmailSent: true,
            paymentConfirmed: false
        };
        submissions.unshift(submission);
        localStorage.setItem('pendingVideoSubmissions', JSON.stringify(submissions));
        return submission;
    }

    /**
     * Store pending membership request
     */
    function storePendingMembershipRequest(data) {
        const requests = JSON.parse(localStorage.getItem('pendingMemberRequests') || '[]');
        const request = {
            id: generateId(),
            name: data.name,
            email: data.email,
            plan: data.plan,
            price: formatMembershipPrice(data.plan),
            requestedAt: new Date().toISOString(),
            stage1EmailSent: true,
            paymentConfirmed: false
        };
        requests.unshift(request);
        localStorage.setItem('pendingMemberRequests', JSON.stringify(requests));
        return request;
    }

    /**
     * Get all pending video submissions
     */
    function getPendingVideoSubmissions() {
        return JSON.parse(localStorage.getItem('pendingVideoSubmissions') || '[]')
            .filter(s => !s.paymentConfirmed);
    }

    /**
     * Get all pending membership requests
     */
    function getPendingMembershipRequests() {
        return JSON.parse(localStorage.getItem('pendingMemberRequests') || '[]')
            .filter(r => !r.paymentConfirmed);
    }

    /**
     * Mark video submission as payment confirmed
     */
    function confirmVideoPayment(submissionId) {
        const submissions = JSON.parse(localStorage.getItem('pendingVideoSubmissions') || '[]');
        const index = submissions.findIndex(s => s.id === submissionId);
        if (index !== -1) {
            submissions[index].paymentConfirmed = true;
            submissions[index].confirmedAt = new Date().toISOString();
            localStorage.setItem('pendingVideoSubmissions', JSON.stringify(submissions));
            return submissions[index];
        }
        return null;
    }

    /**
     * Mark membership as payment confirmed
     */
    function confirmMembershipPayment(requestId) {
        const requests = JSON.parse(localStorage.getItem('pendingMemberRequests') || '[]');
        const index = requests.findIndex(r => r.id === requestId);
        if (index !== -1) {
            requests[index].paymentConfirmed = true;
            requests[index].confirmedAt = new Date().toISOString();
            localStorage.setItem('pendingMemberRequests', JSON.stringify(requests));

            // Also add to active members
            const members = JSON.parse(localStorage.getItem('members') || '[]');
            members.push({
                name: requests[index].name,
                email: requests[index].email,
                plan: requests[index].plan,
                active: true,
                wins: 0,
                joinedAt: new Date().toISOString()
            });
            localStorage.setItem('members', JSON.stringify(members));

            return requests[index];
        }
        return null;
    }

    // ============================================
    // PUBLIC API
    // ============================================
    return {
        init,
        CONFIG,

        // Video Analysis
        sendVideoSubmissionReceived,
        sendVideoAdminNotification,
        sendVideoPaymentConfirmed,

        // Membership
        sendMembershipReceived,
        sendMembershipAdminNotification,
        sendMembershipPaymentConfirmed,

        // Referral Program
        sendReferralPending,
        sendReferralConfirmed,
        sendRewardUnlocked,
        sendRewardClaimed,
        sendAmbassadorAchieved,

        // Instructor Network
        sendInstructorWelcome,
        sendInstructorApproved,
        sendInstructorReferralUpdate,
        sendInstructorGraceEnding,
        sendInstructorPaused,
        sendInstructorReactivated,

        // Skill Evaluations
        sendEvaluationReceived,
        sendEvaluationComplete,

        // Storage
        storePendingVideoSubmission,
        storePendingMembershipRequest,
        getPendingVideoSubmissions,
        getPendingMembershipRequests,
        confirmVideoPayment,
        confirmMembershipPayment,

        // Utilities
        generateId,
        formatDate,
        formatPrice,
        formatVideoLength,
        formatMembershipPrice,
        formatPlanType
    };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        EmailService.init();
    });
} else {
    EmailService.init();
}
