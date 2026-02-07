#!/usr/bin/env node
/**
 * News Aggregator for Margulan
 * Collects news with 33% exploration rule for source diversity
 */

const fs = require('fs');
const path = require('path');

// Load source tracking data
const sourceTrackingPath = path.join(__dirname, 'source-status-tracking.json');
let sourceTracking = {};

try {
  sourceTracking = JSON.parse(fs.readFileSync(sourceTrackingPath, 'utf8'));
} catch (e) {
  console.warn('Could not load source tracking data, initializing empty');
}

const sources = {
  proven: [
    // High-rating sources (>1.5 rating, >10 reactions)
    'https://feeds.feedburner.com/TechCrunch',
    'https://www.technologyreview.com/feed/',
    'https://spectrum.ieee.org/feeds/topic/robotics.rss',
  ],
  
  exploration: [
    // New/testing sources  
    'https://feeds.reuters.com/reuters/technologyNews',
    'https://evtol.com/feed',
    'https://www.producthunt.com/feed',
    'https://news.ycombinator.com/rss',
    '@serge_ai' // Telegram channel from Margulan
  ],
  
  keywords: [
    'artificial intelligence',
    'машинное обучение', 
    'robotics',
    'eVTOL',
    'electric aircraft',
    'drone delivery',
    'startup funding',
    'вайбкодинг',
    'business automation'
  ],
  
  discovery_targets: [
    // Auto-discovery from these hubs
    'https://openai.com/blog',
    'https://blog.google/technology/ai/',
    'https://evtol.com',
    'https://techcrunch.com/tag/artificial-intelligence/'
  ]
};

// Enhanced scoring with hierarchical priority system
function scoreRelevance(title, content, source, sourceInfo = {}) {
  const text = (title + ' ' + content).toLowerCase();
  
  // Get priority weights from config
  const topicPriorities = sourceTracking.digest_config?.topic_priorities || {};
  
  let baseScore = 0;
  let categoryWeight = 1;
  let detectedCategory = 'other';
  
  // Hierarchical category detection with new priority weights
  if (text.includes('artificial intelligence') || text.includes('ai ') || text.includes('машинное обучение') || text.includes('нейрон')) {
    baseScore = 10;
    categoryWeight = topicPriorities.AI?.weight || 10;
    detectedCategory = 'AI';
  } else if (text.includes('робот') || text.includes('robot') || text.includes('automation') || text.includes('автоматизация')) {
    baseScore = 9;
    categoryWeight = topicPriorities.robotics?.weight || 9;
    detectedCategory = 'robotics';
  } else if (text.includes('evtol') || text.includes('electric aircraft') || text.includes('drone') || text.includes('дрон')) {
    baseScore = 8;
    categoryWeight = topicPriorities.eVTOL?.weight || 8;
    detectedCategory = 'eVTOL';
  } else if (text.includes('вайбкодинг') || text.includes('no-code') || text.includes('low-code') || text.includes('productivity')) {
    baseScore = 7;
    categoryWeight = topicPriorities.tools?.weight || 7;
    detectedCategory = 'tools';
  } else if (text.includes('tech') || text.includes('технолог') || text.includes('innovation')) {
    baseScore = 6;
    categoryWeight = topicPriorities.technology?.weight || 6;
    detectedCategory = 'technology';
  } else if (text.includes('startup') || text.includes('стартап') || text.includes('business') || text.includes('бизнес')) {
    baseScore = 5;
    categoryWeight = topicPriorities.business?.weight || 5;
    detectedCategory = 'business';
  } else if (text.includes('investment') || text.includes('crypto') || text.includes('инвест') || text.includes('funding')) {
    baseScore = 4;
    categoryWeight = topicPriorities.investments?.weight || 4;
    detectedCategory = 'investments';
  } else {
    baseScore = 3;
    categoryWeight = topicPriorities.other?.weight || 3;
    detectedCategory = 'other';
  }
  
  // Apply priority weighting
  let score = baseScore * (categoryWeight / 10);
  
  // Source category modifiers
  if (sourceInfo.status === 'user_recommended') {
    score *= 2.5; // User recommendations get priority boost
  } else if (sourceInfo.exploration_status === 'new') {
    score *= 1.2; // New sources get exploration bonus
  } else if (sourceInfo.avg_rating > 1.5 && sourceInfo.total_reactions > 10) {
    score *= sourceInfo.avg_rating; // Proven sources scaled by rating
  }
  
  // Store detected category for later use
  if (!sourceInfo.detected_category) {
    sourceInfo.detected_category = detectedCategory;
  }
  
  return {
    score: Math.round(score * 10) / 10,
    category: detectedCategory,
    priority_level: topicPriorities[detectedCategory]?.priority_level || 8
  };
}

// Categorize sources by exploration status
function categorizeSourcesByStatus() {
  const proven = [];
  const exploration = [];
  
  // Categorize based on tracking data
  for (const [sourceName, info] of Object.entries(sourceTracking.sources || {})) {
    if (info.avg_rating > 1.5 && info.total_reactions > 10) {
      proven.push({ name: sourceName, info });
    } else {
      exploration.push({ name: sourceName, info });
    }
  }
  
  return { proven, exploration };
}

// Apply adaptive priority-based selection with exploration rule
function applyAdaptivePrioritySelection(allNews, targetCount = null) {
  // Load digest config
  const digestConfig = sourceTracking.digest_config || {
    min_news: 10,
    max_news: 15, 
    target_news: 12,
    exploration_ratio: 0.33,
    quality_threshold: 5.0
  };
  
  // Enhanced news scoring with priority detection
  const scoredNews = allNews.map(article => {
    const sourceInfo = sourceTracking.sources?.[article.source] || {};
    const relevanceResult = scoreRelevance(article.title || '', article.content || '', article.source, sourceInfo);
    
    return {
      ...article,
      enhanced_score: relevanceResult.score,
      category: relevanceResult.category,
      priority_level: relevanceResult.priority_level,
      source_info: sourceInfo
    };
  });
  
  // Determine optimal count based on available quality news
  if (!targetCount) {
    const highQualityNews = scoredNews.filter(n => n.enhanced_score >= digestConfig.quality_threshold).length;
    
    if (highQualityNews >= digestConfig.max_news) {
      targetCount = digestConfig.max_news;
    } else if (highQualityNews >= digestConfig.target_news) {
      targetCount = digestConfig.target_news;
    } else if (highQualityNews >= digestConfig.min_news) {
      targetCount = digestConfig.min_news;
    } else {
      targetCount = Math.max(digestConfig.min_news, highQualityNews);
    }
    
    console.log(`📊 Adaptive sizing: ${highQualityNews} quality articles → ${targetCount} news target`);
  }
  
  // Analyze priority distribution
  const priorityDistribution = analyzePriorityDistribution(scoredNews);
  console.log(`🎯 Priority analysis:`, priorityDistribution);
  
  // Apply adaptive priority selection
  const selectedNews = selectByAdaptivePriority(scoredNews, targetCount, priorityDistribution);
  
  return selectedNews;
}

// Analyze current priority distribution to detect "hot periods"
function analyzePriorityDistribution(scoredNews) {
  const distribution = {};
  const topicPriorities = sourceTracking.digest_config?.topic_priorities || {};
  
  // Count articles by category and calculate average scores
  scoredNews.forEach(article => {
    if (!distribution[article.category]) {
      distribution[article.category] = {
        count: 0,
        total_score: 0,
        avg_score: 0,
        priority_level: article.priority_level,
        max_share: topicPriorities[article.category]?.max_share || 0.1
      };
    }
    
    distribution[article.category].count++;
    distribution[article.category].total_score += article.enhanced_score;
  });
  
  // Calculate averages and detect hot topics
  Object.keys(distribution).forEach(category => {
    const data = distribution[category];
    data.avg_score = data.total_score / data.count;
    data.is_hot = data.count >= 3 && data.avg_score >= 7; // Hot if 3+ articles with avg score 7+
  });
  
  return distribution;
}

// Select news based on adaptive priority system
function selectByAdaptivePriority(scoredNews, targetCount, priorityDistribution) {
  const selected = [];
  const explorationCount = Math.max(1, Math.ceil(targetCount * 0.33)); // Maintain 33% exploration
  let remainingSlots = targetCount;
  
  // Sort by priority level, then by enhanced score
  const sortedNews = [...scoredNews].sort((a, b) => {
    if (a.priority_level !== b.priority_level) {
      return a.priority_level - b.priority_level; // Lower priority_level = higher priority
    }
    return b.enhanced_score - a.enhanced_score; // Higher score first
  });
  
  // Separate by exploration status
  const provenNews = sortedNews.filter(article => {
    const sourceInfo = sourceTracking.sources?.[article.source] || {};
    return sourceInfo.avg_rating > 1.5 && sourceInfo.total_reactions > 10;
  });
  
  const explorationNews = sortedNews.filter(article => {
    const sourceInfo = sourceTracking.sources?.[article.source] || {};
    return !(sourceInfo.avg_rating > 1.5 && sourceInfo.total_reactions > 10);
  });
  
  // Select exploration sources first (maintain 33% rule)
  selected.push(...explorationNews.slice(0, explorationCount));
  remainingSlots -= Math.min(explorationCount, explorationNews.length);
  
  // Fill remaining slots with proven sources by priority
  selected.push(...provenNews.slice(0, remainingSlots));
  
  // Log priority breakdown
  const categoryBreakdown = {};
  selected.forEach(article => {
    categoryBreakdown[article.category] = (categoryBreakdown[article.category] || 0) + 1;
  });
  
  console.log(`🎯 Selected news breakdown:`, categoryBreakdown);
  console.log(`📊 Applied priority rule: ${selected.length} total (${explorationCount} exploration, ${selected.length - explorationCount} proven)`);
  
  return selected.slice(0, targetCount); // Ensure we don't exceed target
}

// Legacy function for backward compatibility
function applyExplorationRule(allNews, targetCount = null) {
  return applyAdaptivePrioritySelection(allNews, targetCount);
}

// Update source statistics after user reactions
function updateSourceStats(sourceName, reaction) {
  if (!sourceTracking.sources) sourceTracking.sources = {};
  if (!sourceTracking.sources[sourceName]) {
    sourceTracking.sources[sourceName] = {
      total_reactions: 0,
      avg_rating: 0,
      first_added: new Date().toISOString().split('T')[0],
      exploration_status: 'new'
    };
  }
  
  const source = sourceTracking.sources[sourceName];
  const reactionValue = {
    '👍': 2, '❤️': 2, '🔥': 2,
    '👎': -2, '💩': -3,
    '🤔': 0, '💡': 1
  }[reaction] || 0;
  
  // Update average rating
  const totalScore = source.avg_rating * source.total_reactions + reactionValue;
  source.total_reactions++;
  source.avg_rating = totalScore / source.total_reactions;
  
  // Update exploration status
  if (source.total_reactions > 10 && source.avg_rating > 1.5) {
    source.exploration_status = 'proven';
  } else if (source.total_reactions > 5) {
    source.exploration_status = 'candidate';
  }
  
  // Save updated data
  fs.writeFileSync(sourceTrackingPath, JSON.stringify(sourceTracking, null, 2));
  console.log(`📈 Updated ${sourceName}: ${source.avg_rating.toFixed(1)} rating (${source.total_reactions} reactions)`);
}

// Discover new sources automatically  
function discoverNewSources() {
  const discoveries = {
    trending_hashtags: [],
    related_channels: [],
    citation_analysis: []
  };
  
  // This would implement actual discovery logic
  // For now, it's a placeholder for future enhancement
  console.log('🔍 Source discovery system ready');
  
  return discoveries;
}

module.exports = { 
  sources, 
  scoreRelevance, 
  categorizeSourcesByStatus,
  applyExplorationRule,
  applyAdaptivePrioritySelection,
  analyzePriorityDistribution,
  selectByAdaptivePriority,
  updateSourceStats,
  discoverNewSources
};

if (require.main === module) {
  console.log('🚀 News Aggregator with 33% Exploration Rule');
  console.log(`📊 Proven sources: ${sources.proven.length}`);
  console.log(`🔍 Exploration sources: ${sources.exploration.length}`);
  
  const { proven, exploration } = categorizeSourcesByStatus();
  console.log(`📈 Current stats: ${proven.length} proven, ${exploration.length} exploring`);
}