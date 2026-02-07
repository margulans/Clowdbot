#!/usr/bin/env node
/**
 * Automatic Source Discovery System
 * Finds new high-quality sources for news digests
 */

const fs = require('fs');
const path = require('path');

const sourceTrackingPath = path.join(__dirname, 'source-status-tracking.json');

// Discovery targets and keywords
const discoveryConfig = {
  keywords: [
    'artificial intelligence', 'машинное обучение', 'AI research',
    'robotics', 'робототехника', 'autonomous systems',
    'eVTOL', 'electric aircraft', 'urban air mobility', 'drone delivery',
    'startup funding', 'стартап', 'business automation',
    'productivity tools', 'вайбкодинг', 'no-code'
  ],
  
  discovery_methods: {
    'trending_hashtags': {
      priority: 8,
      description: 'Search trending hashtags in target topics'
    },
    'citation_analysis': {
      priority: 10,
      description: 'Sources cited by high-quality articles'
    },
    'user_recommendations': {
      priority: 15,
      description: 'Sources recommended by Margulan'
    },
    'related_channels': {
      priority: 6,
      description: 'Channels mentioned by proven sources'
    },
    'topic_clustering': {
      priority: 4,
      description: 'Keyword-based discovery of new channels'
    }
  },
  
  source_types: [
    'telegram_channel',
    'rss_feed', 
    'blog',
    'news_website',
    'research_publication',
    'youtube_channel',
    'twitter_account'
  ]
};

// Load current source tracking
let sourceTracking = {};
try {
  sourceTracking = JSON.parse(fs.readFileSync(sourceTrackingPath, 'utf8'));
} catch (e) {
  sourceTracking = {
    sources: {},
    exploration_stats: {},
    exploration_queue: { high_priority: [], medium_priority: [], low_priority: [] }
  };
}

// Simulate source discovery (placeholder for real implementations)
function discoverSourcesByCitation() {
  console.log('🔍 Analyzing citation patterns in quality articles...');
  
  // This would analyze articles from proven sources and extract citations/mentions
  const discoveredSources = [
    {
      name: '@ai_daily_digest',
      type: 'telegram_channel',
      discovery_method: 'citation_analysis',
      relevance_score: 8.5,
      topics: ['AI', 'research'],
      cited_by: '@serge_ai'
    },
    {
      name: 'https://evtol.news/feed',
      type: 'rss_feed', 
      discovery_method: 'citation_analysis',
      relevance_score: 9.2,
      topics: ['eVTOL', 'aviation'],
      cited_by: 'multiple_sources'
    }
  ];
  
  return discoveredSources;
}

function discoverSourcesByTrends() {
  console.log('📈 Searching trending sources in target topics...');
  
  // This would use APIs to find trending sources
  const trendingSources = [
    {
      name: '@robotics_today',
      type: 'telegram_channel',
      discovery_method: 'trending_hashtags',
      relevance_score: 7.3,
      topics: ['robotics', 'automation'],
      trend_indicators: ['#robotics', '#automation']
    }
  ];
  
  return trendingSources;
}

function discoverSourcesByTopics() {
  console.log('🎯 Topic-based source discovery...');
  
  // This would search for sources containing our keywords
  const topicSources = [
    {
      name: 'https://techcrunch.com/tag/artificial-intelligence/feed/',
      type: 'rss_feed',
      discovery_method: 'topic_clustering', 
      relevance_score: 6.8,
      topics: ['AI', 'business', 'startups'],
      keyword_matches: ['artificial intelligence', 'startup funding']
    }
  ];
  
  return topicSources;
}

// Add discovered source to exploration queue
function addToExplorationQueue(source) {
  if (!sourceTracking.exploration_queue) {
    sourceTracking.exploration_queue = {
      high_priority: [],
      medium_priority: [],
      low_priority: []
    };
  }
  
  const priority = source.discovery_method === 'user_recommendations' ? 'high_priority' :
                  source.relevance_score > 8.0 ? 'high_priority' :
                  source.relevance_score > 6.0 ? 'medium_priority' : 'low_priority';
  
  // Check if already exists
  const existsInSources = sourceTracking.sources.hasOwnProperty(source.name);
  const existsInQueue = Object.values(sourceTracking.exploration_queue)
    .some(queue => queue.some(item => item.name === source.name));
  
  if (!existsInSources && !existsInQueue) {
    sourceTracking.exploration_queue[priority].push({
      ...source,
      discovered_date: new Date().toISOString(),
      status: 'queued'
    });
    
    console.log(`➕ Added ${source.name} to ${priority} queue (score: ${source.relevance_score})`);
    return true;
  }
  
  return false;
}

// Process exploration queue and promote sources to active testing
function processExplorationQueue() {
  console.log('⚡ Processing exploration queue...');
  
  let promoted = 0;
  const maxPromotions = 3; // Don't overwhelm the system
  
  // Process high priority first
  for (const priority of ['high_priority', 'medium_priority', 'low_priority']) {
    const queue = sourceTracking.exploration_queue[priority] || [];
    
    for (let i = 0; i < queue.length && promoted < maxPromotions; i++) {
      const source = queue[i];
      
      // Promote to active exploration
      if (!sourceTracking.sources[source.name]) {
        sourceTracking.sources[source.name] = {
          status: 'auto_discovered',
          category: source.topics[0] || 'unknown',
          total_reactions: 0,
          avg_rating: 0,
          first_added: new Date().toISOString().split('T')[0],
          priority_bonus: Math.round(source.relevance_score),
          exploration_status: 'new',
          discovery_method: source.discovery_method,
          discovery_date: source.discovered_date,
          topics: source.topics
        };
        
        console.log(`🚀 Promoted ${source.name} to active exploration`);
        promoted++;
        
        // Remove from queue
        queue.splice(i, 1);
        i--; // Adjust index after removal
      }
    }
  }
  
  console.log(`✅ Promoted ${promoted} sources to active exploration`);
  return promoted;
}

// Check exploration ratio and suggest actions
function checkExplorationBalance() {
  const stats = sourceTracking.exploration_stats || {};
  const totalActive = (stats.proven_sources || 0) + (stats.exploration_sources || 0);
  const explorationRatio = totalActive > 0 ? Math.round((stats.exploration_sources || 0) / totalActive * 100) : 0;
  
  console.log(`📊 Current exploration ratio: ${explorationRatio}% (target: 33%)`);
  
  if (explorationRatio < 25) {
    console.log('⚠️  LOW exploration ratio - need more new sources!');
    return 'need_more_sources';
  } else if (explorationRatio > 45) {
    console.log('⚠️  HIGH exploration ratio - focus on promoting proven sources');
    return 'too_many_experimental';
  } else {
    console.log('✅ Exploration ratio is balanced');
    return 'balanced';
  }
}

// Generate discovery report
function generateDiscoveryReport() {
  const totalSources = Object.keys(sourceTracking.sources || {}).length;
  const queueSize = Object.values(sourceTracking.exploration_queue || {})
    .reduce((sum, queue) => sum + queue.length, 0);
  
  const report = {
    timestamp: new Date().toISOString(),
    total_active_sources: totalSources,
    queued_sources: queueSize,
    exploration_balance: checkExplorationBalance(),
    recent_discoveries: Object.values(sourceTracking.sources || {})
      .filter(s => {
        const discoveryDate = new Date(s.discovery_date || s.first_added);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return discoveryDate > weekAgo;
      }).length,
    recommendations: []
  };
  
  // Add recommendations
  if (report.exploration_balance === 'need_more_sources') {
    report.recommendations.push('Increase source discovery efforts');
    report.recommendations.push('Process more items from exploration queue');
  }
  
  if (queueSize > 10) {
    report.recommendations.push('Large discovery queue - consider processing more sources');
  }
  
  if (report.recent_discoveries === 0) {
    report.recommendations.push('No recent discoveries - run discovery methods');
  }
  
  return report;
}

// Main discovery workflow
function runDiscovery() {
  console.log('🚀 Starting source discovery workflow...');
  
  // Run discovery methods
  const citationSources = discoverSourcesByCitation();
  const trendingSources = discoverSourcesByTrends();
  const topicSources = discoverSourcesByTopics();
  
  // Add to exploration queue
  let newSources = 0;
  [...citationSources, ...trendingSources, ...topicSources].forEach(source => {
    if (addToExplorationQueue(source)) {
      newSources++;
    }
  });
  
  // Process queue
  const promoted = processExplorationQueue();
  
  // Save updated data
  fs.writeFileSync(sourceTrackingPath, JSON.stringify(sourceTracking, null, 2));
  
  // Generate report
  const report = generateDiscoveryReport();
  
  console.log('📋 Discovery Summary:');
  console.log(`   🆕 New sources discovered: ${newSources}`);
  console.log(`   🚀 Sources promoted: ${promoted}`);
  console.log(`   📊 Balance status: ${report.exploration_balance}`);
  
  if (report.recommendations.length > 0) {
    console.log('💡 Recommendations:');
    report.recommendations.forEach(rec => console.log(`   • ${rec}`));
  }
  
  return report;
}

// CLI usage
if (require.main === module) {
  const command = process.argv[2] || 'run';
  
  switch (command) {
    case 'run':
      runDiscovery();
      break;
      
    case 'status':
      console.log(generateDiscoveryReport());
      break;
      
    case 'process-queue':
      processExplorationQueue();
      fs.writeFileSync(sourceTrackingPath, JSON.stringify(sourceTracking, null, 2));
      break;
      
    case 'check-balance':
      checkExplorationBalance();
      break;
      
    default:
      console.log('Usage: node source-discovery.js [run|status|process-queue|check-balance]');
  }
}

module.exports = { 
  runDiscovery, 
  processExplorationQueue, 
  checkExplorationBalance,
  generateDiscoveryReport 
};