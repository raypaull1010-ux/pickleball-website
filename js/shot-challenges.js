/**
 * Weekly Shot Challenges Module
 * Handles all client-side interactions with the shot challenges system
 */

const ShotChallenges = {
  // API base URL
  apiBase: '/.netlify/functions/api-shot-challenges',

  // Current week's data cache
  currentWeek: null,

  // ==========================================
  // API Methods
  // ==========================================

  /**
   * Get current week's challenges
   */
  async getCurrentChallenges() {
    try {
      const token = localStorage.getItem('auth_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

      const response = await fetch(this.apiBase, { headers });
      const data = await response.json();

      if (data.active) {
        this.currentWeek = data;
      }

      return data;
    } catch (error) {
      console.error('Error fetching challenges:', error);
      return { active: false, challenges: [] };
    }
  },

  /**
   * Get all challenge definitions
   */
  async getAllDefinitions() {
    try {
      const response = await fetch(`${this.apiBase}/definitions`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching definitions:', error);
      return { definitions: [] };
    }
  },

  /**
   * Get user's weekly progress
   */
  async getProgress() {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return { progress: null, submissions: [] };

      const response = await fetch(`${this.apiBase}/progress`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return await response.json();
    } catch (error) {
      console.error('Error fetching progress:', error);
      return { progress: null, submissions: [] };
    }
  },

  /**
   * Submit a challenge video
   */
  async submitVideo(challengeId, videoUrl, videoDuration = null) {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        return { success: false, error: 'Must be logged in to submit' };
      }

      const response = await fetch(`${this.apiBase}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          challenge_id: challengeId,
          video_url: videoUrl,
          video_duration: videoDuration
        })
      });

      return await response.json();
    } catch (error) {
      console.error('Error submitting video:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get submission history
   */
  async getHistory() {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return { history: [] };

      const response = await fetch(`${this.apiBase}/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return await response.json();
    } catch (error) {
      console.error('Error fetching history:', error);
      return { history: [] };
    }
  },

  /**
   * Get weekly leaderboard
   */
  async getLeaderboard() {
    try {
      const response = await fetch(`${this.apiBase}/leaderboard`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      return { leaderboard: [] };
    }
  },

  // ==========================================
  // UI Rendering Methods
  // ==========================================

  /**
   * Render the weekly challenges section
   */
  renderWeeklyChallenges(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    this.getCurrentChallenges().then(data => {
      if (!data.active) {
        container.innerHTML = `
          <div class="no-challenges">
            <p>No active challenges this week. Check back soon!</p>
          </div>
        `;
        return;
      }

      const { schedule, challenges, user_progress } = data;
      const completedCount = user_progress?.challenges_completed || 0;
      const totalCount = challenges.length;
      const earnedXP = user_progress?.total_xp_earned || 0;

      container.innerHTML = `
        <div class="weekly-challenges-container">
          <div class="weekly-header">
            <h3>🥒 ${schedule.theme || "This Week's Missions"}</h3>
            <div class="weekly-timer">
              <span>⏰ Resets in:</span>
              <span class="time">${schedule.time_remaining.formatted}</span>
            </div>
          </div>

          <div class="weekly-stats">
            <span><span class="completed">${completedCount}</span> of ${totalCount} completed</span>
            <span>+${earnedXP} XP earned this week</span>
          </div>
          <div class="weekly-progress-bar">
            <div class="weekly-progress-fill" style="width: ${(completedCount / totalCount) * 100}%;"></div>
          </div>

          <div class="shot-challenges-grid">
            ${challenges.map(challenge => this.renderChallengeCard(challenge)).join('')}
          </div>

          ${completedCount < totalCount ? `
            <div class="completion-bonus-banner">
              <p>🏆 Complete all ${totalCount} challenges for a <strong>+${schedule.completion_bonus_xp} XP Bonus!</strong></p>
            </div>
          ` : `
            <div class="completion-bonus-banner earned">
              <p>🎉 Congratulations! You earned the +${schedule.completion_bonus_xp} XP completion bonus!</p>
            </div>
          `}
        </div>
      `;

      // Attach event listeners
      this.attachChallengeEvents(container);
    });
  },

  /**
   * Render individual challenge card
   */
  renderChallengeCard(challenge) {
    const submission = challenge.user_submission;
    const status = submission?.status || 'not_started';
    const statusClass = this.getStatusClass(status);
    const isBonus = challenge.is_bonus;

    const difficultyStars = Array(4).fill(0).map((_, i) =>
      `<span class="star ${i < challenge.difficulty ? '' : 'empty'}">★</span>`
    ).join('');

    const verificationBadge = this.getVerificationBadge(submission);

    return `
      <div class="shot-challenge-card ${statusClass} ${isBonus ? 'bonus-challenge' : ''}"
           data-challenge-id="${challenge.id}">
        <span class="shot-icon">${challenge.icon}</span>
        <span class="shot-name">${challenge.name}</span>
        <span class="shot-description">${challenge.description}</span>
        <div>
          <span class="shot-reward">+${challenge.xp_reward} XP</span>
          <span class="shot-difficulty">${difficultyStars}</span>
        </div>
        ${verificationBadge}
        ${this.renderActionButton(challenge, status)}
      </div>
    `;
  },

  /**
   * Get CSS class based on status
   */
  getStatusClass(status) {
    switch (status) {
      case 'approved': return 'completed';
      case 'pending':
      case 'ai_reviewing':
      case 'coach_reviewing': return 'pending';
      case 'rejected':
      case 'needs_resubmit': return 'rejected';
      default: return '';
    }
  },

  /**
   * Get verification badge HTML
   */
  getVerificationBadge(submission) {
    if (!submission) return '';

    const badges = {
      'approved': submission.verification_method === 'ai'
        ? '<span class="verification-badge ai">🤖 AI Verified</span>'
        : '<span class="verification-badge coach">👨‍🏫 Coach Verified</span>',
      'pending': '<span class="verification-badge">⏳ Pending Review</span>',
      'ai_reviewing': '<span class="verification-badge ai">🤖 AI Reviewing...</span>',
      'coach_reviewing': '<span class="verification-badge coach">👨‍🏫 Coach Reviewing...</span>',
      'rejected': '<span class="verification-badge rejected">❌ Not Approved</span>',
      'needs_resubmit': '<span class="verification-badge rejected">🔄 Resubmit Required</span>'
    };

    return badges[submission.status] || '';
  },

  /**
   * Render action button based on status
   */
  renderActionButton(challenge, status) {
    switch (status) {
      case 'approved':
        return `<button class="upload-shot-btn completed" disabled>✓ Completed!</button>`;
      case 'pending':
      case 'ai_reviewing':
      case 'coach_reviewing':
        return `<button class="upload-shot-btn pending" disabled>📹 Awaiting Review</button>`;
      case 'rejected':
      case 'needs_resubmit':
        return `<button class="upload-shot-btn resubmit" data-action="upload">📹 Resubmit Video</button>`;
      default:
        return `<button class="upload-shot-btn" data-action="upload">📹 Upload Video</button>`;
    }
  },

  /**
   * Attach event listeners to challenge cards
   */
  attachChallengeEvents(container) {
    container.querySelectorAll('[data-action="upload"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const card = e.target.closest('[data-challenge-id]');
        const challengeId = card.dataset.challengeId;
        this.showUploadModal(challengeId);
      });
    });
  },

  /**
   * Show upload modal
   */
  showUploadModal(challengeId) {
    // Find challenge details
    const challenge = this.currentWeek?.challenges?.find(c => c.id === challengeId);
    if (!challenge) return;

    const modal = document.createElement('div');
    modal.className = 'shot-upload-modal';
    modal.innerHTML = `
      <div class="modal-overlay" data-close="modal"></div>
      <div class="modal-content">
        <button class="modal-close" data-close="modal">&times;</button>
        <h2>${challenge.icon} ${challenge.name}</h2>
        <p class="modal-description">${challenge.description}</p>

        <div class="tips-section">
          <h4>💡 Tips for Success:</h4>
          <ul>
            ${(challenge.tips || []).map(tip => `<li>${tip}</li>`).join('')}
          </ul>
        </div>

        <form id="shot-upload-form">
          <div class="form-group">
            <label for="video-url">Video URL</label>
            <input type="url" id="video-url" name="video_url" required
                   placeholder="Paste YouTube, TikTok, or direct video link">
            <small>Supports YouTube, TikTok, Instagram, or direct video URLs</small>
          </div>

          <div class="form-group">
            <label for="video-duration">Video Duration (seconds)</label>
            <input type="number" id="video-duration" name="video_duration"
                   min="3" max="120" placeholder="e.g., 15">
          </div>

          <div class="verification-info">
            <p>
              ${challenge.verification_type === 'ai'
                ? '🤖 This challenge will be automatically verified by AI'
                : '👨‍🏫 This challenge will be reviewed by a coach'}
            </p>
            <p class="xp-reward">Potential Reward: <strong>+${challenge.xp_reward} XP</strong></p>
          </div>

          <button type="submit" class="submit-btn">
            📤 Submit for Review
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 10);

    // Close handlers
    modal.querySelectorAll('[data-close="modal"]').forEach(el => {
      el.addEventListener('click', () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
      });
    });

    // Form submission
    modal.querySelector('#shot-upload-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const submitBtn = form.querySelector('.submit-btn');
      const originalText = submitBtn.textContent;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';

      const videoUrl = form.video_url.value;
      const videoDuration = form.video_duration.value ? parseInt(form.video_duration.value) : null;

      const result = await this.submitVideo(challengeId, videoUrl, videoDuration);

      if (result.success) {
        // Show success
        modal.querySelector('.modal-content').innerHTML = `
          <div class="submission-success">
            <span class="success-icon">✅</span>
            <h2>Video Submitted!</h2>
            <p>Your video has been submitted for review.</p>
            <p class="status-info">
              ${result.verification_type === 'ai'
                ? 'AI is analyzing your video...'
                : 'A coach will review your submission soon.'}
            </p>
            <button class="close-btn" data-close="modal">Close</button>
          </div>
        `;
        modal.querySelector('[data-close="modal"]').addEventListener('click', () => {
          modal.classList.remove('active');
          setTimeout(() => {
            modal.remove();
            // Refresh challenges
            this.renderWeeklyChallenges(document.querySelector('.weekly-challenges-container')?.parentElement?.id);
          }, 300);
        });
      } else {
        // Show error
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        alert('Error: ' + (result.error || 'Failed to submit video'));
      }
    });
  },

  /**
   * Render leaderboard
   */
  async renderLeaderboard(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const { leaderboard } = await this.getLeaderboard();

    if (!leaderboard.length) {
      container.innerHTML = '<p class="no-data">No leaderboard data yet this week.</p>';
      return;
    }

    container.innerHTML = `
      <div class="challenge-leaderboard">
        <h4>🏆 Weekly Challenge Leaderboard</h4>
        <div class="leaderboard-list">
          ${leaderboard.map((entry, i) => `
            <div class="leaderboard-entry ${i < 3 ? 'top-three' : ''}">
              <span class="rank">${this.getRankEmoji(entry.rank)}</span>
              <div class="player-info">
                <span class="player-name">${entry.display_name}</span>
                <span class="challenges-count">${entry.challenges_completed}/${entry.total_challenges} completed</span>
              </div>
              <span class="xp-earned">+${entry.total_xp_earned} XP</span>
              ${entry.bonus_earned ? '<span class="bonus-badge">🎯 All Done!</span>' : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  /**
   * Get rank emoji
   */
  getRankEmoji(rank) {
    const emojis = { 1: '🥇', 2: '🥈', 3: '🥉' };
    return emojis[rank] || `#${rank}`;
  }
};

// Add CSS styles
const shotChallengesStyles = `
  .shot-upload-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10000;
    opacity: 0;
    visibility: hidden;
    transition: all 0.3s ease;
  }

  .shot-upload-modal.active {
    opacity: 1;
    visibility: visible;
  }

  .shot-upload-modal .modal-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.7);
    backdrop-filter: blur(4px);
  }

  .shot-upload-modal .modal-content {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    border-radius: 20px;
    padding: 32px;
    max-width: 500px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
  }

  .shot-upload-modal .modal-close {
    position: absolute;
    top: 16px;
    right: 16px;
    background: none;
    border: none;
    font-size: 28px;
    cursor: pointer;
    color: #6b7280;
  }

  .shot-upload-modal h2 {
    margin-bottom: 8px;
    font-size: 1.5rem;
  }

  .shot-upload-modal .modal-description {
    color: #6b7280;
    margin-bottom: 20px;
  }

  .shot-upload-modal .tips-section {
    background: #f0fdf4;
    border: 1px solid #86efac;
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 24px;
  }

  .shot-upload-modal .tips-section h4 {
    margin-bottom: 8px;
    color: #166534;
  }

  .shot-upload-modal .tips-section ul {
    margin: 0;
    padding-left: 20px;
    color: #15803d;
  }

  .shot-upload-modal .tips-section li {
    margin-bottom: 4px;
  }

  .shot-upload-modal .form-group {
    margin-bottom: 20px;
  }

  .shot-upload-modal label {
    display: block;
    font-weight: 600;
    margin-bottom: 6px;
  }

  .shot-upload-modal input {
    width: 100%;
    padding: 12px 16px;
    border: 2px solid #e5e7eb;
    border-radius: 10px;
    font-size: 16px;
    transition: border-color 0.2s;
  }

  .shot-upload-modal input:focus {
    outline: none;
    border-color: #667eea;
  }

  .shot-upload-modal small {
    display: block;
    margin-top: 4px;
    color: #9ca3af;
    font-size: 13px;
  }

  .shot-upload-modal .verification-info {
    background: #f3f4f6;
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 24px;
    text-align: center;
  }

  .shot-upload-modal .verification-info p {
    margin: 0 0 8px 0;
    color: #6b7280;
  }

  .shot-upload-modal .xp-reward {
    color: #10b981;
    font-size: 18px;
  }

  .shot-upload-modal .submit-btn {
    width: 100%;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    border: none;
    padding: 16px 24px;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }

  .shot-upload-modal .submit-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(16, 185, 129, 0.4);
  }

  .shot-upload-modal .submit-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .submission-success {
    text-align: center;
    padding: 40px 20px;
  }

  .submission-success .success-icon {
    font-size: 64px;
    display: block;
    margin-bottom: 16px;
  }

  .submission-success h2 {
    color: #10b981;
  }

  .submission-success .status-info {
    color: #6b7280;
    margin: 16px 0 24px;
  }

  .submission-success .close-btn {
    background: #667eea;
    color: white;
    border: none;
    padding: 12px 32px;
    border-radius: 10px;
    font-size: 16px;
    cursor: pointer;
  }

  .completion-bonus-banner {
    margin-top: 24px;
    padding: 16px;
    background: rgba(255,255,255,0.05);
    border-radius: 12px;
    text-align: center;
  }

  .completion-bonus-banner p {
    margin: 0;
    font-size: 14px;
    color: rgba(255,255,255,0.7);
  }

  .completion-bonus-banner.earned {
    background: rgba(16, 185, 129, 0.2);
    border: 2px solid #10b981;
  }

  .completion-bonus-banner.earned p {
    color: #10b981;
  }

  .upload-shot-btn.resubmit {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  }

  .shot-challenge-card.rejected {
    border-color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  .verification-badge.rejected {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .challenge-leaderboard {
    background: white;
    border-radius: 16px;
    padding: 24px;
  }

  .challenge-leaderboard h4 {
    margin-bottom: 20px;
    font-size: 1.2rem;
  }

  .challenge-leaderboard .leaderboard-entry {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 16px;
    background: #f9fafb;
    border-radius: 12px;
    margin-bottom: 8px;
  }

  .challenge-leaderboard .leaderboard-entry.top-three {
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  }

  .challenge-leaderboard .rank {
    font-size: 24px;
    min-width: 40px;
  }

  .challenge-leaderboard .player-info {
    flex: 1;
  }

  .challenge-leaderboard .player-name {
    font-weight: 700;
    display: block;
  }

  .challenge-leaderboard .challenges-count {
    font-size: 13px;
    color: #6b7280;
  }

  .challenge-leaderboard .xp-earned {
    font-weight: 700;
    color: #10b981;
  }

  .challenge-leaderboard .bonus-badge {
    background: #10b981;
    color: white;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = shotChallengesStyles;
  document.head.appendChild(styleSheet);
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ShotChallenges;
}
