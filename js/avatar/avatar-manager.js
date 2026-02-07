/**
 * 🎮 AVATAR MANAGER
 * Ray's Pickleball Platform
 *
 * Client-side avatar management for the Digital Avatar System.
 * Handles avatar display, stat updates, and API communication.
 */

class AvatarManager {
    constructor(options = {}) {
        this.options = {
            apiBaseUrl: options.apiBaseUrl || '/api',
            onStatUpdate: options.onStatUpdate || null,
            onError: options.onError || console.error,
            ...options
        };

        this.currentAvatar = null;
        this.statHistory = [];
    }

    /**
     * Calculate overall rating from individual stats
     */
    calculateOverallRating(stats) {
        const weights = {
            power: 0.15,
            finesse: 0.20,
            speed: 0.15,
            court_iq: 0.20,
            consistency: 0.20,
            mental: 0.10
        };

        let total = 0;
        for (const [stat, weight] of Object.entries(weights)) {
            const value = stats[stat] || stats[`stat_${stat}`] || 50;
            total += value * weight;
        }

        return Math.round(total);
    }

    /**
     * Get rank tier from points
     */
    getRankTier(points) {
        if (points >= 5000) return { tier: 'Grandmaster', icon: '👑', color: '#ff6b6b' };
        if (points >= 4000) return { tier: 'Master', icon: '💎', color: '#a855f7' };
        if (points >= 3000) return { tier: 'Diamond', icon: '💠', color: '#60a5fa' };
        if (points >= 2000) return { tier: 'Platinum', icon: '🔷', color: '#22d3d3' };
        if (points >= 1000) return { tier: 'Gold', icon: '🥇', color: '#fbbf24' };
        if (points >= 500) return { tier: 'Silver', icon: '🥈', color: '#9ca3af' };
        return { tier: 'Bronze', icon: '🥉', color: '#cd7f32' };
    }

    /**
     * Format a stat value with color coding
     */
    getStatColor(value) {
        if (value >= 90) return '#ffd700'; // Gold - Elite
        if (value >= 80) return '#a855f7'; // Purple - Excellent
        if (value >= 70) return '#22c55e'; // Green - Good
        if (value >= 60) return '#3b82f6'; // Blue - Above Average
        if (value >= 50) return '#f59e0b'; // Orange - Average
        return '#ef4444'; // Red - Below Average
    }

    /**
     * Get stat rating label
     */
    getStatLabel(value) {
        if (value >= 95) return 'ELITE';
        if (value >= 85) return 'EXCELLENT';
        if (value >= 75) return 'GREAT';
        if (value >= 65) return 'GOOD';
        if (value >= 55) return 'AVERAGE';
        if (value >= 45) return 'DEVELOPING';
        return 'BEGINNER';
    }

    /**
     * Render an avatar card to a container element
     */
    renderAvatarCard(avatar, containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container #${containerId} not found`);
            return;
        }

        const overall = avatar.overall_rating || this.calculateOverallRating(avatar);
        const rank = this.getRankTier(avatar.rank_points || 0);

        const stats = [
            { name: 'Power', key: 'power', icon: '💪', color: '#ef4444' },
            { name: 'Finesse', key: 'finesse', icon: '🎯', color: '#10b981' },
            { name: 'Speed', key: 'speed', icon: '⚡', color: '#3b82f6' },
            { name: 'Court IQ', key: 'court_iq', icon: '🧠', color: '#8b5cf6' },
            { name: 'Consistency', key: 'consistency', icon: '🎲', color: '#f59e0b' },
            { name: 'Mental', key: 'mental', icon: '🔥', color: '#ec4899' }
        ];

        // Calculate rating angle for circular gauge (0-360deg, but we use 0-280deg)
        const ratingAngle = Math.round((overall / 99) * 280);

        const html = `
            <div class="avatar-card" data-avatar-id="${avatar.id || ''}">
                <div class="avatar-header">
                    <div class="avatar-image-container">
                        <div class="avatar-image" style="background: linear-gradient(135deg, ${avatar.avatar_color_primary || '#667eea'}, ${avatar.avatar_color_secondary || '#764ba2'});">
                            ${avatar.avatar_emoji || '🏓'}
                        </div>
                        <div class="avatar-level-badge">${avatar.level || Math.floor(overall / 2)}</div>
                    </div>
                    <div class="avatar-info">
                        <div class="avatar-name">${this.escapeHtml(avatar.display_name || 'Player')}</div>
                        <div class="avatar-title">${this.escapeHtml(avatar.title || 'Pickleball Player')}</div>
                        <div class="avatar-rank">
                            <span class="rank-icon">${rank.icon}</span>
                            <span>${rank.tier} ${this.getRomanNumeral(avatar.rank_division || 5)} • Top ${this.getPercentile(overall)}%</span>
                        </div>
                    </div>
                    <div class="overall-rating">
                        <div class="rating-circle" style="--rating-angle: ${ratingAngle}deg;">
                            <span class="rating-value">${overall}</span>
                        </div>
                        <div class="rating-label">Overall Rating</div>
                    </div>
                </div>

                <div class="avatar-stats-grid">
                    ${stats.map(stat => {
                        const value = avatar[`stat_${stat.key}`] || avatar[stat.key] || 50;
                        return `
                            <div class="stat-card ${stat.key}" style="--stat-color: ${stat.color}">
                                <div class="stat-icon">${stat.icon}</div>
                                <div class="stat-name">${stat.name}</div>
                                <div class="stat-value">${value}</div>
                                <div class="stat-bar">
                                    <div class="stat-bar-fill" style="width: ${value}%;"></div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        container.innerHTML = html;
        this.currentAvatar = avatar;
    }

    /**
     * Render recent activity feed
     */
    renderActivityFeed(activities, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const iconMap = {
            'coach_assessment': { icon: '👨‍🏫', class: 'coach' },
            'video_analysis': { icon: '🎬', class: 'video' },
            'drill_completion': { icon: '🏋️', class: 'drill' },
            'match_result': { icon: '🏆', class: 'match' },
            'manual': { icon: '✏️', class: 'manual' }
        };

        const html = `
            <div class="avatar-activity">
                <div class="activity-title">
                    <span>📈</span> Recent Stat Updates
                </div>
                <div class="activity-list">
                    ${activities.map(activity => {
                        const iconInfo = iconMap[activity.source_type] || { icon: '📊', class: 'default' };
                        const isPositive = activity.change_amount >= 0;
                        const statName = this.formatStatName(activity.stat_name);

                        return `
                            <div class="activity-item">
                                <div class="activity-icon ${iconInfo.class}">${iconInfo.icon}</div>
                                <div class="activity-content">
                                    <div class="activity-text">${this.escapeHtml(activity.source_description || this.getActivityDescription(activity))}</div>
                                    <div class="activity-time">${this.formatTimeAgo(activity.created_at)}</div>
                                </div>
                                <div class="activity-stat ${isPositive ? '' : 'negative'}">
                                    ${isPositive ? '+' : ''}${activity.change_amount} ${statName}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    /**
     * Generate description for activity based on source type
     */
    getActivityDescription(activity) {
        switch (activity.source_type) {
            case 'coach_assessment':
                return `Coach ${activity.assessed_by_name || 'assessed'} your ${this.formatStatName(activity.stat_name).toLowerCase()}`;
            case 'video_analysis':
                return `Match footage analyzed by AI`;
            case 'drill_completion':
                return `Completed a ${activity.stat_name} drill`;
            case 'match_result':
                return activity.change_amount >= 0 ?
                    `Won a match - mental boost!` :
                    `Lost a close match`;
            default:
                return `${this.formatStatName(activity.stat_name)} updated`;
        }
    }

    /**
     * Format stat name for display
     */
    formatStatName(statName) {
        const names = {
            'power': 'Power',
            'finesse': 'Finesse',
            'speed': 'Speed',
            'court_iq': 'Court IQ',
            'consistency': 'Consistency',
            'mental': 'Mental'
        };
        return names[statName] || statName;
    }

    /**
     * Format timestamp as relative time
     */
    formatTimeAgo(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);

        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;

        return date.toLocaleDateString();
    }

    /**
     * Get Roman numeral for rank division
     */
    getRomanNumeral(num) {
        const numerals = ['I', 'II', 'III', 'IV', 'V'];
        return numerals[Math.min(num - 1, 4)] || 'V';
    }

    /**
     * Get approximate percentile from overall rating
     */
    getPercentile(overall) {
        if (overall >= 90) return 1;
        if (overall >= 85) return 3;
        if (overall >= 80) return 5;
        if (overall >= 75) return 10;
        if (overall >= 70) return 20;
        if (overall >= 65) return 30;
        if (overall >= 60) return 40;
        return 50;
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Animate stat change
     */
    animateStatChange(statKey, oldValue, newValue, duration = 1000) {
        const statElement = document.querySelector(`.stat-card.${statKey} .stat-value`);
        const barElement = document.querySelector(`.stat-card.${statKey} .stat-bar-fill`);

        if (!statElement) return;

        const startTime = performance.now();
        const diff = newValue - oldValue;

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function (ease-out)
            const eased = 1 - Math.pow(1 - progress, 3);

            const currentValue = Math.round(oldValue + diff * eased);
            statElement.textContent = currentValue;

            if (barElement) {
                barElement.style.width = `${currentValue}%`;
            }

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);

        // Add flash effect
        const card = document.querySelector(`.stat-card.${statKey}`);
        if (card) {
            card.classList.add('stat-updating');
            setTimeout(() => card.classList.remove('stat-updating'), duration);
        }
    }

    /**
     * Update avatar stats via API
     */
    async updateStats(avatarId, stats, source = 'manual', notes = '') {
        try {
            const response = await fetch(`${this.options.apiBaseUrl}/avatar/${avatarId}/stats`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    stats,
                    source,
                    notes
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to update stats: ${response.statusText}`);
            }

            const result = await response.json();

            // Trigger callback
            if (this.options.onStatUpdate) {
                this.options.onStatUpdate(result);
            }

            return result;

        } catch (error) {
            this.options.onError(error);
            throw error;
        }
    }

    /**
     * Fetch avatar data from API
     */
    async fetchAvatar(avatarId) {
        try {
            const response = await fetch(`${this.options.apiBaseUrl}/avatar/${avatarId}`);

            if (!response.ok) {
                throw new Error(`Failed to fetch avatar: ${response.statusText}`);
            }

            const avatar = await response.json();
            this.currentAvatar = avatar;
            return avatar;

        } catch (error) {
            this.options.onError(error);
            throw error;
        }
    }

    /**
     * Fetch leaderboard
     */
    async fetchLeaderboard(limit = 10) {
        try {
            const response = await fetch(`${this.options.apiBaseUrl}/avatars/leaderboard?limit=${limit}`);

            if (!response.ok) {
                throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
            }

            return await response.json();

        } catch (error) {
            this.options.onError(error);
            throw error;
        }
    }

    /**
     * Submit video for analysis
     */
    async submitVideoForAnalysis(avatarId, videoFile) {
        try {
            const formData = new FormData();
            formData.append('video', videoFile);
            formData.append('avatar_id', avatarId);

            const response = await fetch(`${this.options.apiBaseUrl}/video/analyze`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Failed to submit video: ${response.statusText}`);
            }

            return await response.json();

        } catch (error) {
            this.options.onError(error);
            throw error;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AvatarManager };
}

// Also attach to window for browser use
if (typeof window !== 'undefined') {
    window.AvatarManager = AvatarManager;
}
