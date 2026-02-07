#!/usr/bin/env node
/**
 * Update source ratings based on user reactions
 * Usage: node update-source-ratings.js <source_name> <reaction>
 */

const fs = require('fs');
const path = require('path');

const sourceTrackingPath = path.join(__dirname, 'source-status-tracking.json');

// Load current tracking data
let sourceTracking = {};
try {
  sourceTracking = JSON.parse(fs.readFileSync(sourceTrackingPath, 'utf8'));
} catch (e) {
  console.error('❌ Could not load source tracking data:', e.message);
  process.exit(1);
}

// Reaction values
const reactionValues = {
  '👍': 2, '❤️': 2, '🔥': 2, '🙌': 2,
  '👎': -2, '💩': -3, '😡': -3,
  '🤔': 0, '💡': 1, '👀': 0.5,
  '🆕': 1.5 // Special bonus for new sources
};

function updateSourceRating(sourceName, reaction) {
  if (!sourceTracking.sources) {
    sourceTracking.sources = {};
  }
  
  // Initialize source if not exists
  if (!sourceTracking.sources[sourceName]) {
    sourceTracking.sources[sourceName] = {
      status: 'auto_discovered',
      category: 'unknown',
      total_reactions: 0,
      avg_rating: 0,
      first_added: new Date().toISOString().split('T')[0],
      priority_bonus: 0,
      exploration_status: 'new',
      reaction_history: []
    };
    
    console.log(`🆕 Added new source: ${sourceName}`);
  }
  
  const source = sourceTracking.sources[sourceName];
  const reactionValue = reactionValues[reaction] || 0;
  
  // Update rating calculation
  const totalScore = source.avg_rating * source.total_reactions + reactionValue;
  source.total_reactions++;
  source.avg_rating = Math.round((totalScore / source.total_reactions) * 100) / 100;
  
  // Add to reaction history
  source.reaction_history = source.reaction_history || [];
  source.reaction_history.push({
    reaction: reaction,
    value: reactionValue,
    date: new Date().toISOString(),
    running_avg: source.avg_rating
  });
  
  // Keep only last 20 reactions to avoid bloat
  if (source.reaction_history.length > 20) {
    source.reaction_history = source.reaction_history.slice(-20);
  }
  
  // Update exploration status
  const oldStatus = source.exploration_status;
  
  if (source.total_reactions > 10 && source.avg_rating >= 1.5) {
    source.exploration_status = 'proven';
  } else if (source.total_reactions > 5) {
    source.exploration_status = 'candidate';
  } else if (source.avg_rating < -1.0 && source.total_reactions > 3) {
    source.exploration_status = 'rejected';
  } else {
    source.exploration_status = 'new';
  }
  
  // Update global stats
  if (!sourceTracking.exploration_stats) {
    sourceTracking.exploration_stats = {
      total_sources: 0,
      proven_sources: 0,
      exploration_sources: 0,
      rejected_sources: 0
    };
  }
  
  const stats = sourceTracking.exploration_stats;
  stats.total_sources = Object.keys(sourceTracking.sources).length;
  stats.proven_sources = Object.values(sourceTracking.sources)
    .filter(s => s.exploration_status === 'proven').length;
  stats.exploration_sources = Object.values(sourceTracking.sources)
    .filter(s => ['new', 'candidate'].includes(s.exploration_status)).length;
  stats.rejected_sources = Object.values(sourceTracking.sources)
    .filter(s => s.exploration_status === 'rejected').length;
  
  // Save updated data
  fs.writeFileSync(sourceTrackingPath, JSON.stringify(sourceTracking, null, 2));
  
  // Log results
  console.log(`📊 Updated ${sourceName}:`);
  console.log(`   Rating: ${source.avg_rating} (${source.total_reactions} reactions)`);
  console.log(`   Status: ${oldStatus} → ${source.exploration_status}`);
  console.log(`   Reaction: ${reaction} (${reactionValue > 0 ? '+' : ''}${reactionValue})`);
  
  // Show promotion/demotion messages
  if (oldStatus !== source.exploration_status) {
    if (source.exploration_status === 'proven') {
      console.log(`🏆 ${sourceName} promoted to PROVEN sources!`);
    } else if (source.exploration_status === 'rejected') {
      console.log(`🗑️  ${sourceName} moved to REJECTED (will retry in 3 months)`);
    } else if (source.exploration_status === 'candidate') {
      console.log(`📈 ${sourceName} upgraded to CANDIDATE status`);
    }
  }
  
  return source;
}

// CLI usage
if (require.main === module) {
  const [sourceName, reaction] = process.argv.slice(2);
  
  if (!sourceName || !reaction) {
    console.log('Usage: node update-source-ratings.js <source_name> <reaction>');
    console.log('');
    console.log('Available reactions:');
    console.log('  👍 ❤️ 🔥 🙌  → +2 points (positive)');
    console.log('  💡           → +1 point (interesting)');
    console.log('  🤔 👀        → 0 points (neutral)');
    console.log('  👎           → -2 points (negative)');
    console.log('  💩 😡        → -3 points (very negative)');
    console.log('  🆕           → +1.5 points (new source bonus)');
    process.exit(1);
  }
  
  if (!reactionValues.hasOwnProperty(reaction)) {
    console.error(`❌ Unknown reaction: ${reaction}`);
    console.log('Available reactions:', Object.keys(reactionValues).join(' '));
    process.exit(1);
  }
  
  try {
    const result = updateSourceRating(sourceName, reaction);
    
    // Show current exploration balance
    const stats = sourceTracking.exploration_stats;
    console.log('');
    console.log('📈 Current source distribution:');
    console.log(`   🏆 Proven: ${stats.proven_sources}`);
    console.log(`   🔍 Exploring: ${stats.exploration_sources}`);
    console.log(`   🗑️  Rejected: ${stats.rejected_sources}`);
    console.log(`   📊 Total: ${stats.total_sources}`);
    
    const explorationRatio = Math.round((stats.exploration_sources / (stats.proven_sources + stats.exploration_sources)) * 100);
    console.log(`   🎯 Exploration ratio: ${explorationRatio}% (target: 33%)`);
    
  } catch (error) {
    console.error('❌ Error updating source rating:', error.message);
    process.exit(1);
  }
}

module.exports = { updateSourceRating, reactionValues };