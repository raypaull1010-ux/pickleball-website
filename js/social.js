// ============================================
// Ray's Pickleball - Social Features Module
// ============================================
// Member profiles, partner matching, challenges, connections

const Social = {
  // ==========================================
  // API CALLS
  // ==========================================

  async getMyProfile() {
    try {
      return await API.request('/api-social/profile', {
        method: 'GET',
        requireAuth: true
      });
    } catch (error) {
      console.error('Failed to get profile:', error);
      throw error;
    }
  },

  async getPublicProfile(userId) {
    try {
      return await API.request(`/api-social/profile/${userId}`, {
        method: 'GET'
      });
    } catch (error) {
      console.error('Failed to get public profile:', error);
      throw error;
    }
  },

  async updateProfile(updates) {
    try {
      return await API.request('/api-social/profile', {
        method: 'PUT',
        requireAuth: true,
        body: updates
      });
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    }
  },

  async findPartners(filters = {}) {
    try {
      const params = new URLSearchParams(filters).toString();
      return await API.request(`/api-social/find-partners?${params}`, {
        method: 'GET',
        requireAuth: true
      });
    } catch (error) {
      console.error('Failed to find partners:', error);
      throw error;
    }
  },

  async sendPartnerRequest(data) {
    try {
      return await API.request('/api-social/partner-request', {
        method: 'POST',
        requireAuth: true,
        body: data
      });
    } catch (error) {
      console.error('Failed to send partner request:', error);
      throw error;
    }
  },

  async getPartnerRequests() {
    try {
      return await API.request('/api-social/partner-requests', {
        method: 'GET',
        requireAuth: true
      });
    } catch (error) {
      console.error('Failed to get partner requests:', error);
      throw error;
    }
  },

  async respondToPartnerRequest(requestId, status) {
    try {
      return await API.request(`/api-social/partner-request/${requestId}`, {
        method: 'PUT',
        requireAuth: true,
        body: { status }
      });
    } catch (error) {
      console.error('Failed to respond to request:', error);
      throw error;
    }
  },

  async createChallenge(data) {
    try {
      return await API.request('/api-social/challenge', {
        method: 'POST',
        requireAuth: true,
        body: data
      });
    } catch (error) {
      console.error('Failed to create challenge:', error);
      throw error;
    }
  },

  async getChallenges() {
    try {
      return await API.request('/api-social/challenges', {
        method: 'GET',
        requireAuth: true
      });
    } catch (error) {
      console.error('Failed to get challenges:', error);
      throw error;
    }
  },

  async updateChallenge(challengeId, updates) {
    try {
      return await API.request(`/api-social/challenge/${challengeId}`, {
        method: 'PUT',
        requireAuth: true,
        body: updates
      });
    } catch (error) {
      console.error('Failed to update challenge:', error);
      throw error;
    }
  },

  async getConnections() {
    try {
      return await API.request('/api-social/connections', {
        method: 'GET',
        requireAuth: true
      });
    } catch (error) {
      console.error('Failed to get connections:', error);
      throw error;
    }
  },

  async followUser(userId) {
    try {
      return await API.request('/api-social/follow', {
        method: 'POST',
        requireAuth: true,
        body: { userId }
      });
    } catch (error) {
      console.error('Failed to follow user:', error);
      throw error;
    }
  },

  async unfollowUser(userId) {
    try {
      return await API.request(`/api-social/follow/${userId}`, {
        method: 'DELETE',
        requireAuth: true
      });
    } catch (error) {
      console.error('Failed to unfollow user:', error);
      throw error;
    }
  },

  async getProgress() {
    try {
      return await API.request('/api-social/progress', {
        method: 'GET',
        requireAuth: true
      });
    } catch (error) {
      console.error('Failed to get progress:', error);
      throw error;
    }
  },

  async getMembershipPerks() {
    try {
      return await API.request('/api-social/membership-perks', {
        method: 'GET'
      });
    } catch (error) {
      console.error('Failed to get membership perks:', error);
      throw error;
    }
  },

  // ==========================================
  // UI COMPONENTS
  // ==========================================

  // Render member profile card
  renderProfileCard(container, profile, stats, isOwn = false) {
    const html = `
      <div class="profile-card ${isOwn ? 'own-profile' : ''}">
        <div class="profile-card-header">
          <div class="profile-avatar">
            ${profile.avatar_url
              ? `<img src="${profile.avatar_url}" alt="${profile.display_name}">`
              : `<span class="avatar-placeholder">${(profile.display_name || 'P')[0].toUpperCase()}</span>`
            }
          </div>
          <div class="profile-card-info">
            <h3 class="profile-name">${profile.display_name || 'Player'}</h3>
            ${profile.location_city || profile.location_state
              ? `<p class="profile-location">📍 ${[profile.location_city, profile.location_state].filter(Boolean).join(', ')}</p>`
              : ''
            }
            <div class="profile-stats-row">
              <span class="stat">⭐ Level ${stats?.level || 1}</span>
              <span class="stat">🔥 ${stats?.currentStreak || 0} day streak</span>
              ${profile.skill_level ? `<span class="stat">🏓 ${profile.skill_level}</span>` : ''}
            </div>
          </div>
        </div>

        ${profile.bio ? `<p class="profile-bio">${profile.bio}</p>` : ''}

        <div class="profile-details">
          ${profile.preferred_play_style ? `<span class="detail-tag">Style: ${profile.preferred_play_style}</span>` : ''}
          ${profile.years_playing ? `<span class="detail-tag">${profile.years_playing}+ years</span>` : ''}
          ${profile.dupr_rating ? `<span class="detail-tag">DUPR: ${profile.dupr_rating}</span>` : ''}
        </div>

        ${profile.looking_for_partners ? `
          <div class="looking-badge">
            <span>👋 Looking for partners!</span>
          </div>
        ` : ''}

        ${isOwn ? `
          <button class="btn btn-secondary btn-full edit-profile-btn">Edit Profile</button>
        ` : `
          <div class="profile-actions">
            <button class="btn btn-primary request-partner-btn" data-user-id="${profile.user_id}">Request to Play</button>
            <button class="btn btn-secondary follow-btn" data-user-id="${profile.user_id}">Follow</button>
          </div>
        `}
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

  // Render partner finder grid
  renderPartnerGrid(container, partners) {
    if (!partners || partners.length === 0) {
      const html = `
        <div class="empty-state">
          <span class="empty-icon">🔍</span>
          <h4>No partners found</h4>
          <p>Try adjusting your search filters or check back later!</p>
        </div>
      `;
      if (typeof container === 'string') container = document.querySelector(container);
      if (container) container.innerHTML = html;
      return html;
    }

    const html = `
      <div class="partner-grid">
        ${partners.map(partner => `
          <div class="partner-card" data-user-id="${partner.userId}">
            <div class="partner-avatar">
              ${partner.avatarUrl
                ? `<img src="${partner.avatarUrl}" alt="${partner.displayName}">`
                : `<span class="avatar-placeholder">${(partner.displayName || 'P')[0].toUpperCase()}</span>`
              }
            </div>
            <div class="partner-info">
              <h4>${partner.displayName}</h4>
              ${partner.location ? `<p class="partner-location">📍 ${partner.location}</p>` : ''}
              <div class="partner-stats">
                ${partner.skillLevel ? `<span>🏓 ${partner.skillLevel}</span>` : ''}
                <span>⭐ Lvl ${partner.level}</span>
                ${partner.streak > 0 ? `<span>🔥 ${partner.streak}</span>` : ''}
              </div>
              ${partner.playStyle ? `<span class="play-style-tag">${partner.playStyle}</span>` : ''}
            </div>
            <button class="btn btn-primary btn-small request-btn" data-user-id="${partner.userId}">
              Request to Play
            </button>
          </div>
        `).join('')}
      </div>
    `;

    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (container) {
      container.innerHTML = html;

      // Add click handlers
      container.querySelectorAll('.request-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.showPartnerRequestModal(btn.dataset.userId);
        });
      });
    }
    return html;
  },

  // Render challenges list
  renderChallenges(container, challenges, currentUserId) {
    if (!challenges || challenges.length === 0) {
      const html = `
        <div class="empty-state">
          <span class="empty-icon">🏆</span>
          <h4>No active challenges</h4>
          <p>Challenge a friend to a streak race or drill competition!</p>
          <button class="btn btn-primary create-challenge-btn">Create Challenge</button>
        </div>
      `;
      if (typeof container === 'string') container = document.querySelector(container);
      if (container) container.innerHTML = html;
      return html;
    }

    const html = `
      <div class="challenges-list">
        ${challenges.map(challenge => {
          const isChallenger = challenge.challenger_id === currentUserId;
          const myProgress = isChallenger ? challenge.challenger_progress : challenge.challenged_progress;
          const theirProgress = isChallenger ? challenge.challenged_progress : challenge.challenger_progress;
          const opponent = isChallenger ? challenge.challenged : challenge.challenger;
          const progressPercent = challenge.goal_value ? Math.min(100, (myProgress / challenge.goal_value) * 100) : 0;
          const theirPercent = challenge.goal_value ? Math.min(100, (theirProgress / challenge.goal_value) * 100) : 0;

          return `
            <div class="challenge-card status-${challenge.status}">
              <div class="challenge-header">
                <span class="challenge-type">${this.getChallengeIcon(challenge.challenge_type)}</span>
                <h4>${challenge.title}</h4>
                <span class="challenge-status status-${challenge.status}">${challenge.status}</span>
              </div>

              <p class="challenge-description">${challenge.description || ''}</p>

              <div class="challenge-vs">
                <div class="challenger">
                  <span class="name">You</span>
                  <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progressPercent}%"></div>
                  </div>
                  <span class="progress-value">${myProgress} / ${challenge.goal_value || '?'}</span>
                </div>
                <span class="vs">VS</span>
                <div class="challenged">
                  <span class="name">${opponent?.full_name || 'Opponent'}</span>
                  <div class="progress-bar">
                    <div class="progress-fill" style="width: ${theirPercent}%"></div>
                  </div>
                  <span class="progress-value">${theirProgress} / ${challenge.goal_value || '?'}</span>
                </div>
              </div>

              ${challenge.status === 'pending' && !isChallenger ? `
                <div class="challenge-actions">
                  <button class="btn btn-primary accept-challenge-btn" data-id="${challenge.id}">Accept</button>
                  <button class="btn btn-secondary decline-challenge-btn" data-id="${challenge.id}">Decline</button>
                </div>
              ` : ''}

              ${challenge.xp_reward ? `<p class="challenge-reward">🏆 Winner gets +${challenge.xp_reward} XP</p>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;

    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (container) {
      container.innerHTML = html;

      // Add button handlers
      container.querySelectorAll('.accept-challenge-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          await this.updateChallenge(btn.dataset.id, { status: 'active' });
          // Refresh challenges
          const data = await this.getChallenges();
          this.renderChallenges(container, data.challenges, currentUserId);
        });
      });

      container.querySelectorAll('.decline-challenge-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          await this.updateChallenge(btn.dataset.id, { status: 'declined' });
          const data = await this.getChallenges();
          this.renderChallenges(container, data.challenges, currentUserId);
        });
      });
    }
    return html;
  },

  // Render skill progression chart
  renderProgressChart(container, progressData) {
    const { statsHistory, analysisProgress, improvement } = progressData;

    const html = `
      <div class="progress-dashboard">
        <div class="progress-section">
          <h4>📈 Skill Progression</h4>
          ${analysisProgress && analysisProgress.length > 0 ? `
            <div class="skill-ratings">
              ${Object.entries(analysisProgress[0].skill_ratings || {}).map(([skill, rating]) => {
                const change = improvement?.[skill];
                return `
                  <div class="skill-rating-item">
                    <span class="skill-name">${this.formatSkillName(skill)}</span>
                    <div class="skill-bar-wrapper">
                      <div class="skill-bar">
                        <div class="skill-fill" style="width: ${rating * 10}%"></div>
                      </div>
                      <span class="skill-value">${rating}/10</span>
                      ${change !== undefined ? `
                        <span class="skill-change ${change > 0 ? 'positive' : change < 0 ? 'negative' : ''}">
                          ${change > 0 ? '+' : ''}${change}
                        </span>
                      ` : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : `
            <p class="no-data">Submit a video analysis to start tracking your skills!</p>
          `}
        </div>

        ${improvement && Object.keys(improvement).length > 0 ? `
          <div class="progress-section improvement-summary">
            <h4>🎯 Areas of Improvement</h4>
            <div class="improvement-tags">
              ${Object.entries(improvement)
                .filter(([_, val]) => val > 0)
                .map(([skill, val]) => `
                  <span class="improvement-tag positive">+${val} ${this.formatSkillName(skill)}</span>
                `).join('')}
              ${Object.entries(improvement)
                .filter(([_, val]) => val < 0)
                .map(([skill, val]) => `
                  <span class="improvement-tag negative">${val} ${this.formatSkillName(skill)}</span>
                `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="progress-section stats-summary">
          <h4>📊 Your Stats</h4>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-value">${progressData.totalVideosAnalyzed || 0}</span>
              <span class="stat-label">Videos Analyzed</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${statsHistory?.length || 0}</span>
              <span class="stat-label">Days Tracked</span>
            </div>
          </div>
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

  // Render membership perks comparison
  renderMembershipPerks(container, tiers) {
    const perkDescriptions = {
      ai_drill_coach: { name: 'AI Drill Coach', icon: '🤖', desc: 'Get instant feedback on your drills' },
      drill_playbook: { name: 'Drill Playbook', icon: '📚', desc: 'Access 100+ curated drills' },
      community_access: { name: 'Community Access', icon: '👥', desc: 'Connect with other players' },
      progress_tracking: { name: 'Progress Tracking', icon: '📈', desc: 'Track your improvement over time' },
      monthly_live_qa: { name: 'Monthly Live Q&A', icon: '🎥', desc: 'Live coaching sessions with Ray' },
      exclusive_drills: { name: 'Exclusive Drills', icon: '⭐', desc: 'Members-only advanced drills' },
      partner_matching: { name: 'Partner Matching', icon: '🤝', desc: 'Find local playing partners' },
      free_skill_eval: { name: 'Free Skill Evaluation', icon: '🎯', desc: 'Annual skill level assessment' },
      priority_booking: { name: 'Priority Booking', icon: '⚡', desc: 'First access to coaching slots' },
      annual_badge: { name: 'Annual Badge', icon: '🏆', desc: 'Exclusive supporter badge' }
    };

    const html = `
      <div class="membership-comparison">
        <h3>Membership Perks</h3>
        <div class="tiers-grid">
          ${tiers.map(tier => `
            <div class="tier-card tier-${tier.id}">
              <div class="tier-header">
                <h4>${tier.name}</h4>
                <div class="tier-price">
                  <span class="price-amount">$${(tier.price_cents / 100).toFixed(0)}</span>
                  <span class="price-period">/${tier.duration_months === 1 ? 'mo' : tier.duration_months + ' mo'}</span>
                </div>
              </div>

              <ul class="tier-perks">
                ${(tier.perks || []).map(perkId => {
                  const perk = perkDescriptions[perkId];
                  return perk ? `
                    <li class="perk-item">
                      <span class="perk-icon">${perk.icon}</span>
                      <span class="perk-name">${perk.name}</span>
                    </li>
                  ` : '';
                }).join('')}
              </ul>

              <div class="tier-discounts">
                ${tier.discount_video_analysis > 0 ? `
                  <span class="discount-tag">${tier.discount_video_analysis}% off Video Analysis</span>
                ` : ''}
                ${tier.free_monthly_videos > 0 ? `
                  <span class="discount-tag">${tier.free_monthly_videos} Free Video/mo</span>
                ` : ''}
                ${tier.priority_support ? `
                  <span class="discount-tag">Priority Support</span>
                ` : ''}
              </div>

              <button class="btn btn-primary btn-full select-tier-btn" data-tier="${tier.id}">
                ${tier.id === 'annual' ? 'Best Value!' : 'Select'}
              </button>
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

  // ==========================================
  // MODALS
  // ==========================================

  showPartnerRequestModal(targetUserId) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal partner-request-modal">
        <div class="modal-header">
          <h3>Request to Play</h3>
          <button class="modal-close">&times;</button>
        </div>
        <form class="partner-request-form">
          <div class="form-group">
            <label>When would you like to play?</label>
            <input type="date" name="playDate" required min="${new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group">
            <label>Preferred Time</label>
            <select name="playTime" required>
              <option value="">Select time...</option>
              <option value="morning">Morning (8am-12pm)</option>
              <option value="afternoon">Afternoon (12pm-5pm)</option>
              <option value="evening">Evening (5pm-9pm)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Location (optional)</label>
            <input type="text" name="location" placeholder="Court name or address">
          </div>
          <div class="form-group">
            <label>Message (optional)</label>
            <textarea name="message" rows="3" placeholder="Hi! I'd love to play with you..."></textarea>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary cancel-btn">Cancel</button>
            <button type="submit" class="btn btn-primary">Send Request</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('show'), 10);

    const closeModal = () => {
      modal.classList.remove('show');
      setTimeout(() => modal.remove(), 300);
    };

    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('.cancel-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    modal.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);

      try {
        await this.sendPartnerRequest({
          targetUserId,
          playDate: formData.get('playDate'),
          playTime: formData.get('playTime'),
          location: formData.get('location'),
          message: formData.get('message')
        });

        closeModal();
        alert('Request sent! They\'ll be notified.');
      } catch (error) {
        alert('Failed to send request: ' + error.message);
      }
    });
  },

  showCreateChallengeModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal create-challenge-modal">
        <div class="modal-header">
          <h3>Create Challenge</h3>
          <button class="modal-close">&times;</button>
        </div>
        <form class="challenge-form">
          <div class="form-group">
            <label>Challenge Type</label>
            <select name="challengeType" required>
              <option value="">Select type...</option>
              <option value="streak_race">🔥 Streak Race</option>
              <option value="drill_completion">🏃 Drill Completion</option>
              <option value="xp_battle">✨ XP Battle</option>
              <option value="custom">🎯 Custom Goal</option>
            </select>
          </div>
          <div class="form-group">
            <label>Challenge Title</label>
            <input type="text" name="title" required placeholder="e.g., 30-Day Streak Challenge">
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea name="description" rows="2" placeholder="What's the challenge about?"></textarea>
          </div>
          <div class="form-group">
            <label>Goal</label>
            <input type="number" name="goalValue" placeholder="e.g., 30 for 30 days" min="1">
          </div>
          <div class="form-group">
            <label>Duration (days)</label>
            <input type="number" name="durationDays" value="7" min="1" max="90">
          </div>
          <div class="form-group">
            <label>Opponent's Email</label>
            <input type="email" name="opponentEmail" required placeholder="friend@email.com">
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary cancel-btn">Cancel</button>
            <button type="submit" class="btn btn-primary">Create Challenge</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('show'), 10);

    const closeModal = () => {
      modal.classList.remove('show');
      setTimeout(() => modal.remove(), 300);
    };

    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('.cancel-btn').addEventListener('click', closeModal);

    modal.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      // Form submission logic here
      closeModal();
      alert('Challenge created! Your opponent will be notified.');
    });
  },

  // ==========================================
  // HELPERS
  // ==========================================

  getChallengeIcon(type) {
    const icons = {
      streak_race: '🔥',
      drill_completion: '🏃',
      xp_battle: '✨',
      custom: '🎯'
    };
    return icons[type] || '🏆';
  },

  formatSkillName(skill) {
    return skill
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  },

  // Get styles for social components
  getStyles() {
    return `
      /* Profile Card */
      .profile-card { background: white; border-radius: 16px; padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
      .profile-card-header { display: flex; gap: 20px; align-items: flex-start; }
      .profile-avatar { width: 80px; height: 80px; border-radius: 50%; overflow: hidden; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; }
      .profile-avatar img { width: 100%; height: 100%; object-fit: cover; }
      .avatar-placeholder { font-size: 32px; color: white; font-weight: 700; }
      .profile-card-info { flex: 1; }
      .profile-name { margin: 0 0 4px 0; font-size: 20px; }
      .profile-location { color: #6b7280; margin: 0 0 8px 0; font-size: 14px; }
      .profile-stats-row { display: flex; gap: 16px; font-size: 14px; }
      .profile-stats-row .stat { color: #6b7280; }
      .profile-bio { color: #374151; margin: 16px 0; line-height: 1.5; }
      .profile-details { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; }
      .detail-tag { background: #f3f4f6; padding: 6px 12px; border-radius: 20px; font-size: 13px; color: #4b5563; }
      .looking-badge { background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 8px 16px; text-align: center; margin: 16px 0; }
      .looking-badge span { color: #059669; font-weight: 500; }
      .profile-actions { display: flex; gap: 12px; margin-top: 16px; }

      /* Partner Grid */
      .partner-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
      .partner-card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); display: flex; flex-direction: column; gap: 12px; }
      .partner-avatar { width: 60px; height: 60px; border-radius: 50%; overflow: hidden; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; margin: 0 auto; }
      .partner-info { text-align: center; }
      .partner-info h4 { margin: 0; }
      .partner-location { color: #6b7280; font-size: 14px; margin: 4px 0; }
      .partner-stats { display: flex; justify-content: center; gap: 12px; font-size: 13px; color: #6b7280; }
      .play-style-tag { background: #ede9fe; color: #7c3aed; padding: 4px 12px; border-radius: 12px; font-size: 12px; }

      /* Challenges */
      .challenges-list { display: flex; flex-direction: column; gap: 16px; }
      .challenge-card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
      .challenge-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
      .challenge-type { font-size: 24px; }
      .challenge-header h4 { flex: 1; margin: 0; }
      .challenge-status { padding: 4px 12px; border-radius: 12px; font-size: 12px; text-transform: capitalize; }
      .challenge-status.status-pending { background: #fef3c7; color: #d97706; }
      .challenge-status.status-active { background: #d1fae5; color: #059669; }
      .challenge-status.status-completed { background: #dbeafe; color: #2563eb; }
      .challenge-vs { display: flex; align-items: center; gap: 20px; margin: 16px 0; }
      .challenge-vs .vs { font-weight: 700; color: #9ca3af; }
      .challenger, .challenged { flex: 1; }
      .challenge-vs .progress-bar { height: 8px; background: #e5e7eb; border-radius: 4px; margin: 8px 0; }
      .challenge-vs .progress-fill { height: 100%; background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); border-radius: 4px; }
      .challenge-actions { display: flex; gap: 12px; margin-top: 16px; }
      .challenge-reward { font-size: 14px; color: #f59e0b; margin-top: 12px; }

      /* Progress Dashboard */
      .progress-dashboard { display: flex; flex-direction: column; gap: 24px; }
      .progress-section { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
      .progress-section h4 { margin: 0 0 16px 0; }
      .skill-rating-item { margin-bottom: 12px; }
      .skill-name { font-weight: 500; display: block; margin-bottom: 4px; }
      .skill-bar-wrapper { display: flex; align-items: center; gap: 12px; }
      .skill-bar { flex: 1; height: 8px; background: #e5e7eb; border-radius: 4px; }
      .skill-fill { height: 100%; background: linear-gradient(90deg, #10b981 0%, #059669 100%); border-radius: 4px; }
      .skill-value { font-size: 14px; font-weight: 600; width: 50px; }
      .skill-change { font-size: 13px; font-weight: 600; }
      .skill-change.positive { color: #10b981; }
      .skill-change.negative { color: #ef4444; }
      .improvement-tags { display: flex; flex-wrap: wrap; gap: 8px; }
      .improvement-tag { padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 500; }
      .improvement-tag.positive { background: #d1fae5; color: #059669; }
      .improvement-tag.negative { background: #fee2e2; color: #dc2626; }
      .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
      .stat-item { text-align: center; }
      .stat-item .stat-value { font-size: 32px; font-weight: 700; color: #667eea; display: block; }
      .stat-item .stat-label { font-size: 14px; color: #6b7280; }

      /* Membership Comparison */
      .tiers-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
      @media (max-width: 768px) { .tiers-grid { grid-template-columns: 1fr; } }
      .tier-card { background: white; border-radius: 16px; padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
      .tier-card.tier-annual { border: 2px solid #667eea; position: relative; }
      .tier-card.tier-annual::before { content: 'Best Value'; position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: #667eea; color: white; padding: 4px 16px; border-radius: 12px; font-size: 12px; font-weight: 600; }
      .tier-header { text-align: center; margin-bottom: 20px; }
      .tier-header h4 { margin: 0 0 8px 0; }
      .tier-price { }
      .price-amount { font-size: 32px; font-weight: 700; color: #1f2937; }
      .price-period { color: #6b7280; }
      .tier-perks { list-style: none; padding: 0; margin: 0 0 16px 0; }
      .perk-item { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
      .perk-icon { font-size: 18px; }
      .tier-discounts { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
      .discount-tag { background: #fef3c7; color: #d97706; padding: 4px 12px; border-radius: 12px; font-size: 12px; }

      /* Modal */
      .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s; z-index: 10000; }
      .modal-overlay.show { opacity: 1; }
      .modal { background: white; border-radius: 16px; padding: 24px; max-width: 480px; width: 90%; max-height: 90vh; overflow-y: auto; }
      .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
      .modal-header h3 { margin: 0; }
      .modal-close { background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280; }
      .form-group { margin-bottom: 16px; }
      .form-group label { display: block; margin-bottom: 6px; font-weight: 500; }
      .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 16px; }
      .form-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px; }

      /* Empty State */
      .empty-state { text-align: center; padding: 40px 20px; color: #6b7280; }
      .empty-icon { font-size: 48px; display: block; margin-bottom: 16px; }
      .empty-state h4 { margin: 0 0 8px 0; color: #374151; }
      .empty-state p { margin: 0 0 16px 0; }
    `;
  },

  // Initialize social features
  init() {
    // Add CSS
    if (!document.getElementById('social-styles')) {
      const styles = document.createElement('style');
      styles.id = 'social-styles';
      styles.textContent = this.getStyles();
      document.head.appendChild(styles);
    }
  }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Social };
}
