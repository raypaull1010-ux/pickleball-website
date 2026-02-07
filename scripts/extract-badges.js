#!/usr/bin/env node
// One-time script to extract badges from members.html and generate SQL INSERT statements
// Run with: node scripts/extract-badges.js

const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'membership-community', 'members.html');
const html = fs.readFileSync(htmlPath, 'utf-8');

// Extract all badge divs using regex
const badgeRegex = /<div class="badge locked" data-category="([^"]+)" data-type="([^"]+)" data-requirement="([^"]+)">\s*<span class="badge-icon">([^<]+)<\/span>\s*<span class="badge-name">([^<]+)<\/span>\s*<span class="badge-desc">([^<]+)<\/span>\s*<\/div>/g;

const badges = [];
const seenIds = new Set();
let match;

while ((match = badgeRegex.exec(html)) !== null) {
  const [, category, type, requirementStr, icon, name, description] = match;
  const requirement = parseFloat(requirementStr);

  // Generate unique ID
  let id = `${category}-${type}-${requirement}`;
  if (seenIds.has(id)) {
    // Handle collisions
    let suffix = 2;
    while (seenIds.has(`${id}-${suffix}`)) suffix++;
    id = `${id}-${suffix}`;
  }
  seenIds.add(id);

  badges.push({ id, category, type, requirement, icon: icon.trim(), name: name.trim(), description: description.trim() });
}

// Rarity thresholds from members.html getBadgeRarity function
const rarityMap = {
  streak: { common: 4, uncommon: 12, rare: 26, epic: 52, legendary: 100 },
  completed: { common: 10, uncommon: 50, rare: 100, epic: 250, legendary: 500 },
  wins: { common: 5, uncommon: 15, rare: 50, epic: 100, legendary: 200 },
  points: { common: 500, uncommon: 2000, rare: 5000, epic: 10000, legendary: 50000 },
  referrals: { common: 3, uncommon: 10, rare: 25, epic: 50, legendary: 100 },
  membership: { common: 30, uncommon: 90, rare: 365, epic: 730, legendary: 1095 }
};

function getRarity(type, requirement) {
  const thresholds = rarityMap[type] || { common: 5, uncommon: 15, rare: 30, epic: 75, legendary: 150 };
  if (requirement >= thresholds.legendary) return 'legendary';
  if (requirement >= thresholds.epic) return 'epic';
  if (requirement >= thresholds.rare) return 'rare';
  if (requirement >= thresholds.uncommon) return 'uncommon';
  return 'common';
}

// Map type to requirement_type for DB schema
function getRequirementType(type) {
  if (type === 'streak' || type === 'logins') return 'streak';
  if (type.startsWith('drill-')) return 'count';
  if (['founder', 'seasonal', 'timeOfDay', 'secret', 'profile', 'perfectWeek', 'comeback', 'winStreak'].includes(type)) return 'special';
  if (['dupr', 'improvement'].includes(type)) return 'milestone';
  if (['leaderboard', 'leaderboardStreak', 'memberNumber'].includes(type)) return 'milestone';
  if (['featured', 'coachPick', 'videoOfWeek', 'videoOfMonth', 'viralVideo', 'cinematic', 'trending', 'videoHallOfFame'].includes(type)) return 'special';
  if (['wallOfFame', 'tipHallOfFame'].includes(type)) return 'special';
  return 'count';
}

// Escape single quotes for SQL
function esc(str) {
  return str.replace(/'/g, "''");
}

console.log(`-- Badge Migration: Extracted ${badges.length} badges from members.html`);
console.log(`-- Generated on: ${new Date().toISOString()}`);
console.log('');
console.log('-- First, remove the old seed badges to replace with comprehensive set');
console.log("DELETE FROM public.badge_definitions WHERE id NOT IN (SELECT badge_id FROM public.user_badges);");
console.log('');
console.log('-- Insert all badges (ON CONFLICT to handle existing ones)');
console.log('INSERT INTO public.badge_definitions (id, name, description, icon, category, xp_reward, requirement_type, requirement_value, requirement_action, is_hidden, rarity) VALUES');

const lines = badges.map((b, i) => {
  const rarity = getRarity(b.type, b.requirement);
  const reqType = getRequirementType(b.type);
  const isHidden = b.type === 'secret';
  const xpReward = 0; // Can be customized later via admin UI
  const comma = i < badges.length - 1 ? ',' : '';
  return `  ('${esc(b.id)}', '${esc(b.name)}', '${esc(b.description)}', '${esc(b.icon)}', '${esc(b.category)}', ${xpReward}, '${reqType}', ${b.requirement}, '${esc(b.type)}', ${isHidden}, '${rarity}')${comma}`;
});

console.log(lines.join('\n'));
console.log('ON CONFLICT (id) DO UPDATE SET');
console.log('  name = EXCLUDED.name,');
console.log('  description = EXCLUDED.description,');
console.log('  icon = EXCLUDED.icon,');
console.log('  category = EXCLUDED.category,');
console.log('  requirement_type = EXCLUDED.requirement_type,');
console.log('  requirement_value = EXCLUDED.requirement_value,');
console.log('  requirement_action = EXCLUDED.requirement_action,');
console.log('  is_hidden = EXCLUDED.is_hidden,');
console.log('  rarity = EXCLUDED.rarity;');
console.log('');

// Print summary
const categories = {};
const rarities = {};
for (const b of badges) {
  categories[b.category] = (categories[b.category] || 0) + 1;
  const r = getRarity(b.type, b.requirement);
  rarities[r] = (rarities[r] || 0) + 1;
}

console.log('-- Summary:');
console.log(`-- Total badges: ${badges.length}`);
console.log('-- By category:');
for (const [cat, count] of Object.entries(categories).sort((a, b) => b[1] - a[1])) {
  console.log(`--   ${cat}: ${count}`);
}
console.log('-- By rarity:');
for (const [r, count] of Object.entries(rarities).sort((a, b) => b[1] - a[1])) {
  console.log(`--   ${r}: ${count}`);
}
