// ============================================
// Ray's Pickleball - Gamification System
// ============================================
// Handles XP, levels, badges, streaks, and leaderboards

const Gamification = {
  // Cache for user data
  _cache: {
    stats: null,
    badges: null,
    leaderboard: null,
    lastFetch: null
  },

  // ==========================================
  // API CALLS
  // ==========================================

  async getStats() {
    try {
      const response = await API.request('/api-gamification', {
        method: 'GET',
        requireAuth: true
      });
      this._cache.stats = response;
      this._cache.lastFetch = Date.now();
      return response;
    } catch (error) {
      console.error('Failed to get gamification stats:', error);
      throw error;
    }
  },

  async dailyCheckin() {
    try {
      const response = await API.request('/api-gamification/checkin', {
        method: 'POST',
        requireAuth: true
      });

      // Update cache
      if (response.success) {
        this._cache.stats = null; // Invalidate cache
      }

      return response;
    } catch (error) {
      console.error('Daily checkin failed:', error);
      throw error;
    }
  },

  async awardXP(action, metadata = {}) {
    try {
      const response = await API.request('/api-gamification/xp', {
        method: 'POST',
        requireAuth: true,
        body: { action, metadata }
      });

      // Invalidate cache
      this._cache.stats = null;

      return response;
    } catch (error) {
      console.error('Failed to award XP:', error);
      throw error;
    }
  },

  async getLeaderboard(period = 'alltime', limit = 10) {
    try {
      const response = await API.request(`/api-gamification/leaderboard?period=${period}&limit=${limit}`, {
        method: 'GET'
      });
      this._cache.leaderboard = response;
      return response;
    } catch (error) {
      console.error('Failed to get leaderboard:', error);
      throw error;
    }
  },

  async getAllBadges() {
    try {
      const response = await API.request('/api-gamification/badges', {
        method: 'GET'
      });
      this._cache.badges = response;
      return response;
    } catch (error) {
      console.error('Failed to get badges:', error);
      throw error;
    }
  },

  async getActivityFeed(limit = 20) {
    try {
      const response = await API.request(`/api-gamification/activity?limit=${limit}`, {
        method: 'GET'
      });
      return response;
    } catch (error) {
      console.error('Failed to get activity feed:', error);
      throw error;
    }
  },

  // ==========================================
  // UI COMPONENTS
  // ==========================================

  // Render XP bar with animation
  renderXPBar(container, stats, levelProgress) {
    const { totalXP, level, currentStreak } = stats;
    const { progressPercent, progressXP, neededXP } = levelProgress;

    const html = `
      <div class="xp-bar-container">
        <div class="xp-header">
          <div class="level-badge">
            <span class="level-icon">⭐</span>
            <span class="level-number">Level ${level}</span>
          </div>
          <div class="xp-numbers">
            <span class="xp-current">${this.formatNumber(totalXP)} XP</span>
          </div>
          ${currentStreak > 0 ? `
            <div class="streak-badge">
              <span class="streak-icon">🔥</span>
              <span class="streak-count">${currentStreak}</span>
            </div>
          ` : ''}
        </div>
        <div class="xp-bar-wrapper">
          <div class="xp-bar">
            <div class="xp-bar-fill" style="width: ${progressPercent}%"></div>
          </div>
          <div class="xp-bar-labels">
            <span>${this.formatNumber(progressXP)} / ${this.formatNumber(neededXP)} XP</span>
            <span>Level ${level + 1}</span>
          </div>
        </div>
      </div>
    `;

    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (container) {
      container.innerHTML = html;
      // Animate the bar
      setTimeout(() => {
        const fill = container.querySelector('.xp-bar-fill');
        if (fill) fill.style.width = `${progressPercent}%`;
      }, 100);
    }
    return html;
  },

  // Render streak calendar
  renderStreakCalendar(container, checkins) {
    const today = new Date();
    const days = [];

    // Generate last 30 days
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const checkin = checkins.find(c => c.checkin_date === dateStr);

      days.push({
        date: dateStr,
        dayOfWeek: date.getDay(),
        dayOfMonth: date.getDate(),
        hasCheckin: !!checkin,
        xpEarned: checkin?.xp_earned || 0,
        streakDay: checkin?.streak_day || 0
      });
    }

    const html = `
      <div class="streak-calendar">
        <div class="streak-calendar-header">
          <h4>🔥 Login Streak</h4>
          <span class="streak-info">${checkins.length} days this month</span>
        </div>
        <div class="streak-calendar-grid">
          ${days.map(day => `
            <div class="streak-day ${day.hasCheckin ? 'active' : ''}"
                 title="${day.date}${day.hasCheckin ? ` - +${day.xpEarned} XP (Day ${day.streakDay})` : ''}">
              <span class="day-number">${day.dayOfMonth}</span>
              ${day.hasCheckin ? '<span class="day-check">✓</span>' : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;

    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (container) {
      container.innerHTML = html;
    }
    return html;
  },

  // Render badges grid
  renderBadges(container, userBadges, allBadges = null) {
    const earnedIds = new Set(userBadges.map(b => b.badge_id));

    // If we have all badges, show both earned and unearned
    let badgesToShow = userBadges.map(ub => ({
      ...ub.badge_definitions,
      earned: true,
      earnedAt: ub.earned_at
    }));

    // Add unearned badges if we have the full list
    if (allBadges) {
      for (const category in allBadges) {
        for (const badge of allBadges[category]) {
          if (!earnedIds.has(badge.id)) {
            badgesToShow.push({
              ...badge,
              earned: false
            });
          }
        }
      }
    }

    // Sort: earned first, then by rarity
    const rarityOrder = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
    badgesToShow.sort((a, b) => {
      if (a.earned !== b.earned) return a.earned ? -1 : 1;
      return rarityOrder[a.rarity] - rarityOrder[b.rarity];
    });

    const html = `
      <div class="badges-container">
        <div class="badges-header">
          <h4>🏆 Badges</h4>
          <span class="badges-count">${userBadges.length} earned</span>
        </div>
        <div class="badges-grid">
          ${badgesToShow.slice(0, 12).map(badge => `
            <div class="badge-item ${badge.earned ? 'earned' : 'locked'} rarity-${badge.rarity}"
                 title="${badge.name}: ${badge.description}${badge.earned ? '' : ' (Locked)'}">
              <span class="badge-icon">${badge.earned ? badge.icon : '🔒'}</span>
              <span class="badge-name">${badge.name}</span>
              ${badge.xp_reward > 0 ? `<span class="badge-xp">+${badge.xp_reward} XP</span>` : ''}
            </div>
          `).join('')}
        </div>
        ${badgesToShow.length > 12 ? `
          <button class="btn btn-secondary btn-small view-all-badges">View All Badges</button>
        ` : ''}
      </div>
    `;

    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (container) {
      container.innerHTML = html;
    }
    return html;
  },

  // Render leaderboard
  renderLeaderboard(container, leaderboard, currentUserId = null) {
    const html = `
      <div class="leaderboard-container">
        <div class="leaderboard-header">
          <h4>🏅 Leaderboard</h4>
          <div class="leaderboard-tabs">
            <button class="tab active" data-period="alltime">All Time</button>
            <button class="tab" data-period="monthly">Monthly</button>
            <button class="tab" data-period="weekly">Weekly</button>
          </div>
        </div>
        <div class="leaderboard-list">
          ${leaderboard.map((entry, index) => `
            <div class="leaderboard-entry ${entry.userId === currentUserId ? 'current-user' : ''}">
              <div class="rank">
                ${index < 3 ? ['🥇', '🥈', '🥉'][index] : `#${entry.rank}`}
              </div>
              <div class="player-info">
                <span class="player-name">${entry.name}</span>
                <span class="player-level">Level ${entry.level}</span>
              </div>
              <div class="player-stats">
                <span class="player-xp">${this.formatNumber(entry.totalXP)} XP</span>
                ${entry.streak > 0 ? `<span class="player-streak">🔥${entry.streak}</span>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (container) {
      container.innerHTML = html;

      // Add tab click handlers
      container.querySelectorAll('.leaderboard-tabs .tab').forEach(tab => {
        tab.addEventListener('click', async (e) => {
          const period = e.target.dataset.period;
          container.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
          e.target.classList.add('active');

          // Fetch new data
          const data = await this.getLeaderboard(period);
          this.renderLeaderboard(container, data.leaderboard, currentUserId);
        });
      });
    }
    return html;
  },

  // Render activity feed
  renderActivityFeed(container, activities) {
    const html = `
      <div class="activity-feed-container">
        <div class="activity-feed-header">
          <h4>📣 Community Activity</h4>
        </div>
        <div class="activity-feed-list">
          ${activities.map(activity => `
            <div class="activity-item activity-${activity.type}">
              <div class="activity-icon">${this.getActivityIcon(activity.type)}</div>
              <div class="activity-content">
                <span class="activity-user">${activity.userName}</span>
                <span class="activity-text">${activity.title}</span>
                <span class="activity-time">${this.formatTimeAgo(activity.createdAt)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (container) {
      container.innerHTML = html;
    }
    return html;
  },

  // Render stats overview
  renderStatsOverview(container, stats) {
    const html = `
      <div class="stats-overview">
        <div class="stat-card">
          <span class="stat-icon">⭐</span>
          <span class="stat-value">${stats.level}</span>
          <span class="stat-label">Level</span>
        </div>
        <div class="stat-card">
          <span class="stat-icon">✨</span>
          <span class="stat-value">${this.formatNumber(stats.totalXP)}</span>
          <span class="stat-label">Total XP</span>
        </div>
        <div class="stat-card">
          <span class="stat-icon">🔥</span>
          <span class="stat-value">${stats.currentStreak}</span>
          <span class="stat-label">Day Streak</span>
        </div>
        <div class="stat-card">
          <span class="stat-icon">🏆</span>
          <span class="stat-value">${stats.longestStreak}</span>
          <span class="stat-label">Best Streak</span>
        </div>
      </div>
    `;

    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (container) {
      container.innerHTML = html;
    }
    return html;
  },

  // ==========================================
  // NOTIFICATIONS & POPUPS
  // ==========================================

  // Show XP earned notification
  showXPNotification(amount, message = '') {
    const notification = document.createElement('div');
    notification.className = 'xp-notification';
    notification.innerHTML = `
      <span class="xp-icon">✨</span>
      <span class="xp-amount">+${amount} XP</span>
      ${message ? `<span class="xp-message">${message}</span>` : ''}
    `;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => notification.classList.add('show'), 10);

    // Remove after animation
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  },

  // Show badge earned popup
  showBadgeEarnedPopup(badge) {
    const popup = document.createElement('div');
    popup.className = 'badge-popup-overlay';
    popup.innerHTML = `
      <div class="badge-popup">
        <div class="badge-popup-content">
          <span class="badge-earned-icon">${badge.icon}</span>
          <h3>Badge Earned!</h3>
          <h4 class="badge-earned-name">${badge.name}</h4>
          <p class="badge-earned-desc">${badge.description}</p>
          ${badge.xp_reward > 0 ? `<p class="badge-earned-xp">+${badge.xp_reward} XP</p>` : ''}
          <button class="btn btn-primary badge-popup-close">Awesome!</button>
        </div>
      </div>
    `;

    document.body.appendChild(popup);

    // Animate in
    setTimeout(() => popup.classList.add('show'), 10);

    // Close handler
    popup.querySelector('.badge-popup-close').addEventListener('click', () => {
      popup.classList.remove('show');
      setTimeout(() => popup.remove(), 300);
    });

    // Close on overlay click
    popup.addEventListener('click', (e) => {
      if (e.target === popup) {
        popup.classList.remove('show');
        setTimeout(() => popup.remove(), 300);
      }
    });
  },

  // Show level up celebration
  showLevelUpCelebration(newLevel) {
    const popup = document.createElement('div');
    popup.className = 'level-up-overlay';
    popup.innerHTML = `
      <div class="level-up-popup">
        <div class="level-up-content">
          <div class="level-up-sparkles">✨🎉✨</div>
          <h2>Level Up!</h2>
          <div class="level-up-number">
            <span class="level-star">⭐</span>
            <span class="level-value">${newLevel}</span>
          </div>
          <p>Congratulations! Keep up the great work!</p>
          <button class="btn btn-primary level-up-close">Continue</button>
        </div>
      </div>
    `;

    document.body.appendChild(popup);

    // Animate in
    setTimeout(() => popup.classList.add('show'), 10);

    // Close handler
    popup.querySelector('.level-up-close').addEventListener('click', () => {
      popup.classList.remove('show');
      setTimeout(() => popup.remove(), 300);
    });
  },

  // Show daily checkin modal
  async showCheckinModal() {
    try {
      const result = await this.dailyCheckin();

      if (result.alreadyCheckedIn) {
        this.showXPNotification(0, 'Already checked in today!');
        return result;
      }

      // Show XP notification
      this.showXPNotification(result.checkin.xpEarned, result.message);

      // Show badges earned
      for (const badge of result.badgesEarned || []) {
        setTimeout(() => this.showBadgeEarnedPopup(badge), 500);
      }

      // Show level up if applicable
      if (result.stats.leveledUp) {
        setTimeout(() => this.showLevelUpCelebration(result.stats.level), 1000);
      }

      return result;
    } catch (error) {
      console.error('Checkin failed:', error);
      throw error;
    }
  },

  // ==========================================
  // HELPERS
  // ==========================================

  formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  },

  formatTimeAgo(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  },

  getActivityIcon(type) {
    const icons = {
      badge_earned: '🏆',
      level_up: '⬆️',
      streak_milestone: '🔥',
      video_submitted: '🎬',
      drill_completed: '🏃',
      default: '📌'
    };
    return icons[type] || icons.default;
  },

  // Auto-checkin on page load (if logged in)
  async autoCheckin() {
    const token = localStorage.getItem('supabase_token');
    if (!token) return;

    try {
      const result = await this.dailyCheckin();
      if (!result.alreadyCheckedIn) {
        this.showXPNotification(result.checkin.xpEarned, result.message);

        // Show badges earned
        for (const badge of result.badgesEarned || []) {
          setTimeout(() => this.showBadgeEarnedPopup(badge), 1500);
        }

        // Show level up if applicable
        if (result.stats.leveledUp) {
          setTimeout(() => this.showLevelUpCelebration(result.stats.level), 2500);
        }
      }
    } catch (error) {
      console.log('Auto-checkin skipped:', error.message);
    }
  },

  // Initialize gamification on page load
  init() {
    // Add CSS for notifications
    if (!document.getElementById('gamification-styles')) {
      const styles = document.createElement('style');
      styles.id = 'gamification-styles';
      styles.textContent = this.getStyles();
      document.head.appendChild(styles);
    }

    // Auto-checkin after a short delay
    setTimeout(() => this.autoCheckin(), 2000);
  },

  // Get CSS styles for gamification components
  getStyles() {
    return `
      /* XP Notification */
      .xp-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        gap: 12px;
        font-weight: 600;
        box-shadow: 0 10px 40px rgba(102, 126, 234, 0.4);
        transform: translateX(120%);
        transition: transform 0.3s ease;
        z-index: 10000;
      }
      .xp-notification.show { transform: translateX(0); }
      .xp-notification .xp-icon { font-size: 24px; }
      .xp-notification .xp-amount { font-size: 18px; }
      .xp-notification .xp-message { font-size: 14px; opacity: 0.9; }

      /* Badge Popup */
      .badge-popup-overlay, .level-up-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s ease;
        z-index: 10001;
      }
      .badge-popup-overlay.show, .level-up-overlay.show { opacity: 1; }
      .badge-popup, .level-up-popup {
        background: white;
        border-radius: 20px;
        padding: 40px;
        text-align: center;
        max-width: 400px;
        transform: scale(0.8);
        transition: transform 0.3s ease;
      }
      .badge-popup-overlay.show .badge-popup,
      .level-up-overlay.show .level-up-popup { transform: scale(1); }
      .badge-earned-icon { font-size: 64px; display: block; margin-bottom: 16px; }
      .badge-earned-name { color: #667eea; margin: 8px 0; }
      .badge-earned-xp { color: #10b981; font-weight: 600; }

      /* Level Up */
      .level-up-sparkles { font-size: 32px; margin-bottom: 16px; }
      .level-up-number { display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 48px; color: #f59e0b; margin: 16px 0; }
      .level-star { font-size: 40px; }

      /* XP Bar */
      .xp-bar-container { background: white; border-radius: 16px; padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
      .xp-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
      .level-badge { display: flex; align-items: center; gap: 8px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 8px 16px; border-radius: 20px; font-weight: 600; }
      .level-icon { font-size: 18px; }
      .xp-numbers { font-weight: 600; color: #374151; }
      .streak-badge { display: flex; align-items: center; gap: 4px; background: #fef3c7; color: #d97706; padding: 8px 16px; border-radius: 20px; font-weight: 600; }
      .xp-bar-wrapper { margin-top: 8px; }
      .xp-bar { height: 12px; background: #e5e7eb; border-radius: 6px; overflow: hidden; }
      .xp-bar-fill { height: 100%; background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); border-radius: 6px; transition: width 1s ease; width: 0; }
      .xp-bar-labels { display: flex; justify-content: space-between; margin-top: 8px; font-size: 13px; color: #6b7280; }

      /* Stats Overview */
      .stats-overview { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
      @media (max-width: 768px) { .stats-overview { grid-template-columns: repeat(2, 1fr); } }
      .stat-card { background: white; border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
      .stat-icon { font-size: 32px; display: block; margin-bottom: 8px; }
      .stat-value { font-size: 28px; font-weight: 700; color: #1f2937; display: block; }
      .stat-label { font-size: 13px; color: #6b7280; }

      /* Streak Calendar */
      .streak-calendar { background: white; border-radius: 16px; padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
      .streak-calendar-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
      .streak-calendar-header h4 { margin: 0; }
      .streak-info { font-size: 13px; color: #6b7280; }
      .streak-calendar-grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px; }
      @media (max-width: 600px) { .streak-calendar-grid { grid-template-columns: repeat(6, 1fr); } }
      .streak-day { aspect-ratio: 1; background: #f3f4f6; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 12px; color: #9ca3af; position: relative; }
      .streak-day.active { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
      .day-check { position: absolute; bottom: 2px; font-size: 10px; }

      /* Badges */
      .badges-container { background: white; border-radius: 16px; padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
      .badges-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
      .badges-header h4 { margin: 0; }
      .badges-count { font-size: 13px; color: #6b7280; }
      .badges-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
      @media (max-width: 768px) { .badges-grid { grid-template-columns: repeat(3, 1fr); } }
      .badge-item { background: #f9fafb; border-radius: 12px; padding: 16px; text-align: center; transition: transform 0.2s; cursor: pointer; }
      .badge-item:hover { transform: translateY(-2px); }
      .badge-item.locked { opacity: 0.5; }
      .badge-item.rarity-legendary { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; }
      .badge-item.rarity-epic { background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%); border: 2px solid #8b5cf6; }
      .badge-item.rarity-rare { background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border: 2px solid #3b82f6; }
      .badge-icon { font-size: 32px; display: block; margin-bottom: 8px; }
      .badge-name { font-size: 12px; font-weight: 600; color: #374151; display: block; }
      .badge-xp { font-size: 11px; color: #10b981; }

      /* Leaderboard */
      .leaderboard-container { background: white; border-radius: 16px; padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
      .leaderboard-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
      .leaderboard-header h4 { margin: 0; }
      .leaderboard-tabs { display: flex; gap: 8px; }
      .leaderboard-tabs .tab { background: #f3f4f6; border: none; padding: 8px 16px; border-radius: 20px; cursor: pointer; font-size: 13px; transition: all 0.2s; }
      .leaderboard-tabs .tab.active { background: #667eea; color: white; }
      .leaderboard-list { display: flex; flex-direction: column; gap: 8px; }
      .leaderboard-entry { display: flex; align-items: center; gap: 16px; padding: 12px 16px; background: #f9fafb; border-radius: 12px; }
      .leaderboard-entry.current-user { background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%); border: 2px solid #8b5cf6; }
      .leaderboard-entry .rank { font-size: 20px; width: 40px; text-align: center; }
      .leaderboard-entry .player-info { flex: 1; }
      .player-name { font-weight: 600; display: block; }
      .player-level { font-size: 12px; color: #6b7280; }
      .player-stats { text-align: right; }
      .player-xp { font-weight: 600; color: #667eea; display: block; }
      .player-streak { font-size: 12px; color: #f59e0b; }

      /* Activity Feed */
      .activity-feed-container { background: white; border-radius: 16px; padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
      .activity-feed-header h4 { margin: 0 0 16px 0; }
      .activity-feed-list { display: flex; flex-direction: column; gap: 12px; max-height: 400px; overflow-y: auto; }
      .activity-item { display: flex; gap: 12px; padding: 12px; background: #f9fafb; border-radius: 12px; }
      .activity-icon { font-size: 24px; }
      .activity-content { flex: 1; }
      .activity-user { font-weight: 600; }
      .activity-text { color: #6b7280; }
      .activity-time { font-size: 12px; color: #9ca3af; display: block; margin-top: 4px; }
    `;
  }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Gamification };
}
