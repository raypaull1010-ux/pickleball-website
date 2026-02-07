/**
 * 📊 INSTRUCTOR PORTAL
 * Ray's Pickleball Platform
 *
 * Allows coaches (Ray, Priscilla, Eddie) to assess and update player avatar stats.
 * Includes form handling, validation, and API communication.
 */

class InstructorPortal {
    constructor(options = {}) {
        this.options = {
            apiBaseUrl: options.apiBaseUrl || '/api',
            containerId: options.containerId || 'instructor-portal',
            onAssessmentSaved: options.onAssessmentSaved || null,
            onError: options.onError || console.error,
            ...options
        };

        this.currentCoach = null;
        this.selectedPlayer = null;
        this.players = [];
        this.originalStats = {};

        // Valid coaches
        this.coaches = [
            { id: 'ray', name: 'Coach Ray', emoji: '👨‍🏫', color: '#667eea' },
            { id: 'priscilla', name: 'Coach Priscilla', emoji: '👩‍🏫', color: '#ec4899' },
            { id: 'eddie', name: 'Coach Eddie', emoji: '🧑‍🏫', color: '#10b981' }
        ];

        this.statConfig = [
            { key: 'power', name: 'Power', icon: '💪', color: '#ef4444', description: 'Serve speed, overhead strength, drive power' },
            { key: 'finesse', name: 'Finesse', icon: '🎯', color: '#10b981', description: 'Dink accuracy, drop shot control, soft game' },
            { key: 'speed', name: 'Speed', icon: '⚡', color: '#3b82f6', description: 'Court coverage, reaction time, transitions' },
            { key: 'court_iq', name: 'Court IQ', icon: '🧠', color: '#8b5cf6', description: 'Shot selection, positioning, strategy' },
            { key: 'consistency', name: 'Consistency', icon: '🎲', color: '#f59e0b', description: 'Unforced errors, rally reliability' },
            { key: 'mental', name: 'Mental', icon: '🔥', color: '#ec4899', description: 'Clutch performance, pressure handling' }
        ];
    }

    /**
     * Initialize the portal with player data
     */
    async init(coachId = null) {
        if (coachId) {
            this.currentCoach = this.coaches.find(c => c.id === coachId);
        }

        // Fetch players (would be from API in production)
        await this.loadPlayers();

        this.render();
        this.attachEventListeners();
    }

    /**
     * Load players from API or use sample data
     */
    async loadPlayers() {
        // In production, this would fetch from API
        // For now, use sample data
        this.players = [
            { id: '1', display_name: 'Ray M.', avatar_emoji: '🏓', overall_rating: 78, stat_power: 72, stat_finesse: 89, stat_speed: 75, stat_court_iq: 82, stat_consistency: 85, stat_mental: 68, avatar_color_primary: '#667eea', avatar_color_secondary: '#764ba2' },
            { id: '2', display_name: 'Sarah K.', avatar_emoji: '🎾', overall_rating: 72, stat_power: 65, stat_finesse: 78, stat_speed: 80, stat_court_iq: 75, stat_consistency: 70, stat_mental: 72, avatar_color_primary: '#10b981', avatar_color_secondary: '#059669' },
            { id: '3', display_name: 'Mike T.', avatar_emoji: '🎯', overall_rating: 65, stat_power: 70, stat_finesse: 60, stat_speed: 65, stat_court_iq: 62, stat_consistency: 68, stat_mental: 60, avatar_color_primary: '#f59e0b', avatar_color_secondary: '#d97706' },
            { id: '4', display_name: 'Lisa R.', avatar_emoji: '⚡', overall_rating: 81, stat_power: 75, stat_finesse: 85, stat_speed: 88, stat_court_iq: 80, stat_consistency: 78, stat_mental: 82, avatar_color_primary: '#ef4444', avatar_color_secondary: '#dc2626' },
            { id: '5', display_name: 'Tom B.', avatar_emoji: '🔥', overall_rating: 59, stat_power: 68, stat_finesse: 52, stat_speed: 58, stat_court_iq: 55, stat_consistency: 60, stat_mental: 55, avatar_color_primary: '#8b5cf6', avatar_color_secondary: '#7c3aed' },
            { id: '6', display_name: 'Emma W.', avatar_emoji: '💪', overall_rating: 74, stat_power: 70, stat_finesse: 80, stat_speed: 72, stat_court_iq: 78, stat_consistency: 75, stat_mental: 70, avatar_color_primary: '#ec4899', avatar_color_secondary: '#db2777' }
        ];
    }

    /**
     * Render the complete portal
     */
    render() {
        const container = document.getElementById(this.options.containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="instructor-portal">
                ${this.renderHeader()}
                ${this.renderPlayerGrid()}
                ${this.renderStatForm()}
            </div>
        `;
    }

    /**
     * Render portal header with coach info
     */
    renderHeader() {
        const coach = this.currentCoach || this.coaches[0];

        return `
            <div class="portal-header">
                <div class="portal-title">
                    <span>📊</span>
                    Instructor Assessment Portal
                </div>
                <div class="portal-instructor">
                    <div class="instructor-avatar">${coach.emoji}</div>
                    <div class="instructor-name">${coach.name}</div>
                </div>
            </div>
            <p style="color: rgba(255, 255, 255, 0.6); margin-bottom: 20px;">
                Select a player to update their avatar stats based on your assessment:
            </p>
        `;
    }

    /**
     * Render player selection grid
     */
    renderPlayerGrid() {
        return `
            <div class="player-select-grid">
                ${this.players.map((player, index) => `
                    <div class="player-select-card ${this.selectedPlayer?.id === player.id ? 'selected' : ''}"
                         data-player-id="${player.id}"
                         data-player-index="${index}">
                        <div class="player-select-avatar" style="background: linear-gradient(135deg, ${player.avatar_color_primary}, ${player.avatar_color_secondary});">
                            ${player.avatar_emoji}
                        </div>
                        <div class="player-select-name">${this.escapeHtml(player.display_name)}</div>
                        <div class="player-select-rating">OVR ${player.overall_rating}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Render stat input form
     */
    renderStatForm() {
        const player = this.selectedPlayer || this.players[0];
        if (!player) return '<div class="stat-input-form">No players available</div>';

        return `
            <div class="stat-input-form" id="stat-form">
                <div style="color: white; font-size: 16px; font-weight: 700; margin-bottom: 20px;">
                    Adjust Stats for ${this.escapeHtml(player.display_name)}
                </div>

                <div class="stat-input-row">
                    ${this.statConfig.slice(0, 3).map(stat => this.renderStatInput(stat, player)).join('')}
                </div>
                <div class="stat-input-row">
                    ${this.statConfig.slice(3, 6).map(stat => this.renderStatInput(stat, player)).join('')}
                </div>

                <div class="stat-changes-preview" id="changes-preview" style="display: none;">
                    <div style="color: #ffd700; font-size: 14px; font-weight: 600; margin-bottom: 10px;">📊 Changes Preview</div>
                    <div id="changes-list"></div>
                </div>

                <div class="assessment-notes">
                    <label>Coach Notes (visible to player)</label>
                    <textarea id="coach-notes" placeholder="Great improvement on third shot drops today. Need to work on mental toughness when down in games..."></textarea>
                </div>

                <div class="submit-assessment">
                    <button class="btn-assessment secondary" id="cancel-btn">Cancel</button>
                    <button class="btn-assessment primary" id="save-btn">💾 Save Assessment</button>
                </div>
            </div>
        `;
    }

    /**
     * Render individual stat input
     */
    renderStatInput(stat, player) {
        const value = player[`stat_${stat.key}`] || 50;

        return `
            <div class="stat-input-group">
                <label class="stat-input-label">
                    <span class="icon">${stat.icon}</span> ${stat.name}
                </label>
                <input type="number"
                       class="stat-input"
                       id="stat-${stat.key}"
                       data-stat="${stat.key}"
                       data-original="${value}"
                       value="${value}"
                       min="1"
                       max="99">
                <div class="stat-hint" style="font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 4px;">
                    ${stat.description}
                </div>
            </div>
        `;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        const container = document.getElementById(this.options.containerId);
        if (!container) return;

        // Player selection
        container.querySelectorAll('.player-select-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const playerId = card.dataset.playerId;
                const playerIndex = parseInt(card.dataset.playerIndex);
                this.selectPlayer(this.players[playerIndex]);
            });
        });

        // Stat input changes
        container.querySelectorAll('.stat-input').forEach(input => {
            input.addEventListener('input', (e) => {
                this.validateStatInput(e.target);
                this.updateChangesPreview();
            });

            input.addEventListener('change', (e) => {
                this.validateStatInput(e.target);
                this.updateChangesPreview();
            });
        });

        // Cancel button
        const cancelBtn = container.querySelector('#cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.resetForm());
        }

        // Save button
        const saveBtn = container.querySelector('#save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveAssessment());
        }
    }

    /**
     * Select a player for assessment
     */
    selectPlayer(player) {
        this.selectedPlayer = player;
        this.originalStats = { ...player };

        // Update UI
        const container = document.getElementById(this.options.containerId);

        // Update selected card styling
        container.querySelectorAll('.player-select-card').forEach(card => {
            card.classList.toggle('selected', card.dataset.playerId === player.id);
        });

        // Update form
        const form = container.querySelector('.stat-input-form');
        if (form) {
            form.innerHTML = this.renderStatForm().match(/<div class="stat-input-form"[^>]*>([\s\S]*?)<\/div>$/)?.[0] || '';

            // Re-render full form
            const formContainer = container.querySelector('.stat-input-form');
            if (formContainer) {
                formContainer.outerHTML = this.renderStatForm();
                this.attachEventListeners();
            }
        }
    }

    /**
     * Validate stat input value
     */
    validateStatInput(input) {
        let value = parseInt(input.value) || 50;
        value = Math.max(1, Math.min(99, value));
        input.value = value;

        // Visual feedback
        const original = parseInt(input.dataset.original) || 50;
        const diff = value - original;

        if (diff > 0) {
            input.style.borderColor = '#10b981';
            input.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.3)';
        } else if (diff < 0) {
            input.style.borderColor = '#ef4444';
            input.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.3)';
        } else {
            input.style.borderColor = '';
            input.style.boxShadow = '';
        }

        return value;
    }

    /**
     * Update changes preview
     */
    updateChangesPreview() {
        const preview = document.getElementById('changes-preview');
        const list = document.getElementById('changes-list');
        if (!preview || !list) return;

        const changes = this.getStatChanges();

        if (changes.length === 0) {
            preview.style.display = 'none';
            return;
        }

        preview.style.display = 'block';
        list.innerHTML = changes.map(change => {
            const isPositive = change.diff > 0;
            const stat = this.statConfig.find(s => s.key === change.key);

            return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 6px;">
                    <span style="color: rgba(255,255,255,0.8);">
                        ${stat?.icon} ${stat?.name}
                    </span>
                    <span style="color: ${isPositive ? '#10b981' : '#ef4444'}; font-weight: 700;">
                        ${change.oldValue} → ${change.newValue} (${isPositive ? '+' : ''}${change.diff})
                    </span>
                </div>
            `;
        }).join('');
    }

    /**
     * Get all stat changes
     */
    getStatChanges() {
        const changes = [];
        const container = document.getElementById(this.options.containerId);

        container?.querySelectorAll('.stat-input').forEach(input => {
            const key = input.dataset.stat;
            const original = parseInt(input.dataset.original) || 50;
            const current = parseInt(input.value) || 50;

            if (current !== original) {
                changes.push({
                    key,
                    oldValue: original,
                    newValue: current,
                    diff: current - original
                });
            }
        });

        return changes;
    }

    /**
     * Reset form to original values
     */
    resetForm() {
        const container = document.getElementById(this.options.containerId);

        container?.querySelectorAll('.stat-input').forEach(input => {
            const original = input.dataset.original || 50;
            input.value = original;
            input.style.borderColor = '';
            input.style.boxShadow = '';
        });

        const notes = document.getElementById('coach-notes');
        if (notes) notes.value = '';

        const preview = document.getElementById('changes-preview');
        if (preview) preview.style.display = 'none';
    }

    /**
     * Save assessment
     */
    async saveAssessment() {
        const changes = this.getStatChanges();
        const notes = document.getElementById('coach-notes')?.value || '';

        if (changes.length === 0 && !notes) {
            this.showNotification('No changes to save', 'warning');
            return;
        }

        const saveBtn = document.getElementById('save-btn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = '⏳ Saving...';
        }

        try {
            // Build assessment data
            const assessment = {
                avatar_id: this.selectedPlayer.id,
                coach_id: this.currentCoach?.id || 'ray',
                notes,
                stats: {}
            };

            // Add changed stats
            for (const change of changes) {
                assessment.stats[change.key] = change.newValue;
            }

            // In production, this would call the API
            // await this.submitAssessment(assessment);

            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Update local player data
            for (const change of changes) {
                this.selectedPlayer[`stat_${change.key}`] = change.newValue;
            }

            // Recalculate overall
            this.selectedPlayer.overall_rating = this.calculateOverallRating(this.selectedPlayer);

            // Update UI
            this.render();
            this.attachEventListeners();

            // Show success
            this.showNotification(`Assessment saved for ${this.selectedPlayer.display_name}!`, 'success');

            // Callback
            if (this.options.onAssessmentSaved) {
                this.options.onAssessmentSaved(assessment, changes);
            }

        } catch (error) {
            this.options.onError(error);
            this.showNotification('Failed to save assessment', 'error');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = '💾 Save Assessment';
            }
        }
    }

    /**
     * Submit assessment to API
     */
    async submitAssessment(assessment) {
        const response = await fetch(`${this.options.apiBaseUrl}/assessments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(assessment)
        });

        if (!response.ok) {
            throw new Error(`Failed to submit assessment: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Calculate overall rating
     */
    calculateOverallRating(player) {
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
            total += (player[`stat_${stat}`] || 50) * weight;
        }

        return Math.round(total);
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `portal-notification ${type}`;
        notification.innerHTML = `
            <span class="notification-icon">
                ${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}
            </span>
            <span class="notification-message">${this.escapeHtml(message)}</span>
        `;

        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 15px 25px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
            color: white;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            gap: 10px;
            font-weight: 600;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(notification);

        // Remove after delay
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    /**
     * Escape HTML
     */
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// Add notification animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { InstructorPortal };
}

if (typeof window !== 'undefined') {
    window.InstructorPortal = InstructorPortal;
}
