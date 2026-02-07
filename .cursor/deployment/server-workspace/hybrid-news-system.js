#!/usr/bin/env node
/**
 * Гибридная система сбора новостей для Маргулана
 * Комбинирует: Brave Search API + RSS + Web Scraping + Fallback
 */

const fs = require('fs');
const path = require('path');

// Конфигурация источников для гибридной системы
const hybridConfig = {
  // Источники с RSS лентами (высокая надёжность)
  rss_sources: [
    {
      name: "MIT Technology Review",
      url: "https://www.technologyreview.com/feed/",
      category: "AI",
      priority: 9,
      keywords: ["artificial intelligence", "machine learning", "AI"]
    },
    {
      name: "IEEE Spectrum Robotics",
      url: "https://spectrum.ieee.org/feeds/topic/robotics.rss",
      category: "robotics", 
      priority: 8,
      keywords: ["robotics", "automation", "robot"]
    },
    {
      name: "TechCrunch",
      url: "https://techcrunch.com/feed/",
      category: "technology",
      priority: 7,
      keywords: ["startup", "tech", "AI", "robotics"]
    },
    {
      name: "eVTOL.com",
      url: "https://evtol.com/feed/",
      category: "eVTOL",
      priority: 8,
      keywords: ["evtol", "electric aircraft", "urban air mobility"]
    }
  ],
  
  // Telegram каналы Маргулана (максимальный приоритет)
  telegram_sources: [
    {name: "@serge_ai", category: "AI", priority: 10, status: "proven"},
    {name: "@data_secrets", category: "AI", priority: 10, status: "exploration"},
    {name: "@khudaibergenkz", category: "business", priority: 10, status: "exploration"},
    {name: "@vibecodings", category: "tools", priority: 10, status: "exploration"},
    {name: "@cryptoEssay", category: "investments", priority: 10, status: "exploration"},
    {name: "@banksta", category: "business", priority: 10, status: "exploration"},
    {name: "@alexkrol", category: "business", priority: 10, status: "exploration"},
    {name: "@andre_dataist", category: "AI", priority: 10, status: "exploration"},
    {name: "@theworldisnoteasy", category: "business", priority: 10, status: "exploration"},
    {name: "@robotless", category: "robotics", priority: 10, status: "exploration"},
    {name: "@obsidianru", category: "tools", priority: 10, status: "exploration"},
    {name: "https://t.me/+UcKkr64NU1tmNTg0", category: "business", priority: 10, status: "exploration"}
  ],

  // Web источники для поиска (через Brave API)
  web_search_targets: [
    {domain: "openai.com", category: "AI", keywords: ["GPT", "OpenAI", "artificial intelligence"]},
    {domain: "blog.google", category: "AI", keywords: ["Google AI", "DeepMind", "Bard"]},
    {domain: "anthropic.com", category: "AI", keywords: ["Claude", "AI safety", "Anthropic"]},
    {domain: "tesla.com", category: "robotics", keywords: ["Tesla Bot", "Optimus", "FSD"]},
    {domain: "jobyaviation.com", category: "eVTOL", keywords: ["Joby", "eVTOL", "air taxi"]},
    {domain: "producthunt.com", category: "tools", keywords: ["product launch", "startup", "tool"]}
  ],

  // Fallback источники (если основные недоступны)
  fallback_sources: [
    "https://news.ycombinator.com",
    "https://www.reuters.com/technology",
    "https://www.theverge.com",
    "https://arstechnica.com"
  ]
};

// Brave Search API интеграция
async function searchWithBrave(query, timeRange = "pd") {
  try {
    // Проверяем наличие API ключа
    const apiKey = process.env.BRAVE_API_KEY;
    if (!apiKey) {
      console.warn('🔑 Brave API key not found. Set BRAVE_API_KEY environment variable');
      return [];
    }

    // Здесь был бы реальный запрос к Brave Search API
    console.log(`🔍 Brave Search: "${query}" (${timeRange})`);
    
    // Заглушка для тестирования
    return [
      {
        title: `Latest ${query} developments`,
        url: `https://example.com/news/${query.replace(' ', '-')}`,
        snippet: `Recent developments in ${query}...`,
        published: new Date().toISOString(),
        source: "brave_search"
      }
    ];
    
  } catch (error) {
    console.error('❌ Brave Search error:', error.message);
    return [];
  }
}

// RSS парсинг
async function parseRSSFeed(source) {
  try {
    console.log(`📡 Parsing RSS: ${source.name}`);
    
    // Здесь был бы реальный RSS парсер
    // Заглушка для демонстрации структуры
    return [
      {
        title: `${source.name} - Latest Article`,
        url: `${source.url}/latest-article`,
        content: `Latest news from ${source.name}...`,
        published: new Date().toISOString(),
        category: source.category,
        source: source.name,
        priority: source.priority
      }
    ];
    
  } catch (error) {
    console.error(`❌ RSS Parse error for ${source.name}:`, error.message);
    return [];
  }
}

// Telegram канал парсинг (через web_fetch)
async function parseTelegramChannel(channelInfo) {
  try {
    console.log(`📱 Parsing Telegram: ${channelInfo.name}`);
    
    // Пока заглушка - в реальности здесь web_fetch к t.me/s/channel
    return [
      {
        title: `${channelInfo.name} - Latest Post`,
        content: `Recent update from ${channelInfo.name}...`,
        published: new Date().toISOString(),
        category: channelInfo.category,
        source: channelInfo.name,
        priority: channelInfo.priority,
        telegram_channel: true
      }
    ];
    
  } catch (error) {
    console.error(`❌ Telegram parse error for ${channelInfo.name}:`, error.message);
    return [];
  }
}

// Главная функция сбора новостей
async function collectHybridNews() {
  console.log('🚀 Starting hybrid news collection...');
  
  const allNews = [];
  const collectionStats = {
    rss_success: 0,
    rss_failed: 0,
    telegram_success: 0,
    telegram_failed: 0,
    brave_success: 0,
    brave_failed: 0,
    total_articles: 0
  };

  // 1. RSS источники (высокая надёжность)
  console.log('📡 Collecting from RSS sources...');
  for (const source of hybridConfig.rss_sources) {
    try {
      const articles = await parseRSSFeed(source);
      allNews.push(...articles);
      collectionStats.rss_success++;
      console.log(`✅ RSS: ${source.name} - ${articles.length} articles`);
    } catch (error) {
      collectionStats.rss_failed++;
      console.log(`❌ RSS: ${source.name} failed`);
    }
  }

  // 2. Telegram каналы (максимальный приоритет)
  console.log('📱 Collecting from Telegram channels...');
  for (const channel of hybridConfig.telegram_sources) {
    try {
      const posts = await parseTelegramChannel(channel);
      allNews.push(...posts);
      collectionStats.telegram_success++;
      console.log(`✅ Telegram: ${channel.name} - ${posts.length} posts`);
    } catch (error) {
      collectionStats.telegram_failed++;
      console.log(`❌ Telegram: ${channel.name} failed`);
    }
  }

  // 3. Brave Search API (широкий охват)
  console.log('🔍 Searching with Brave API...');
  const searchQueries = [
    "OpenAI GPT artificial intelligence",
    "robotics automation breakthrough", 
    "eVTOL electric aircraft urban air mobility",
    "startup funding AI robotics",
    "productivity tools no-code"
  ];
  
  for (const query of searchQueries) {
    try {
      const results = await searchWithBrave(query, "pd"); // past day
      allNews.push(...results);
      collectionStats.brave_success++;
      console.log(`✅ Brave: "${query}" - ${results.length} results`);
    } catch (error) {
      collectionStats.brave_failed++;
      console.log(`❌ Brave: "${query}" failed`);
    }
  }

  collectionStats.total_articles = allNews.length;

  console.log('📊 Collection Summary:');
  console.log(`   📡 RSS: ${collectionStats.rss_success}/${hybridConfig.rss_sources.length} sources`);
  console.log(`   📱 Telegram: ${collectionStats.telegram_success}/${hybridConfig.telegram_sources.length} channels`);
  console.log(`   🔍 Brave: ${collectionStats.brave_success}/${searchQueries.length} queries`);
  console.log(`   📰 Total articles: ${collectionStats.total_articles}`);

  // Сохраняем результаты
  const resultsFile = path.join(__dirname, 'news-cache', `hybrid_${new Date().toISOString().split('T')[0]}.json`);
  await fs.promises.mkdir(path.dirname(resultsFile), { recursive: true });
  await fs.promises.writeFile(resultsFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    stats: collectionStats,
    articles: allNews
  }, null, 2));

  console.log(`💾 Results saved to: ${resultsFile}`);
  return allNews;
}

// Fallback система (если основные источники недоступны)
async function fallbackCollection() {
  console.log('🆘 Activating fallback news collection...');
  
  const fallbackNews = [];
  
  // В реальности здесь web_fetch к fallback источникам
  console.log('📰 Using fallback sources for emergency collection');
  
  return fallbackNews;
}

// Интеллектуальная приоритизация
function prioritizeNews(articles) {
  console.log('🎯 Applying intelligent prioritization...');
  
  return articles.sort((a, b) => {
    // Приоритет по источнику
    const priorityA = a.priority || 5;
    const priorityB = b.priority || 5;
    
    if (priorityA !== priorityB) {
      return priorityB - priorityA; // Высший приоритет первым
    }
    
    // Приоритет по времени публикации
    const timeA = new Date(a.published).getTime();
    const timeB = new Date(b.published).getTime();
    
    return timeB - timeA; // Свежие первыми
  });
}

// CLI интерфейс
if (require.main === module) {
  const command = process.argv[2] || 'collect';
  
  switch (command) {
    case 'collect':
      collectHybridNews()
        .then(news => {
          const prioritized = prioritizeNews(news);
          console.log('\n🏆 Top 5 prioritized articles:');
          prioritized.slice(0, 5).forEach((article, i) => {
            console.log(`${i+1}. ${article.title} (${article.source})`);
          });
        })
        .catch(console.error);
      break;
      
    case 'test':
      console.log('🧪 Testing hybrid system components...');
      console.log('RSS sources:', hybridConfig.rss_sources.length);
      console.log('Telegram channels:', hybridConfig.telegram_sources.length);
      console.log('Web targets:', hybridConfig.web_search_targets.length);
      break;
      
    default:
      console.log('Usage: node hybrid-news-system.js [collect|test]');
  }
}

module.exports = {
  hybridConfig,
  collectHybridNews,
  searchWithBrave,
  parseRSSFeed,
  parseTelegramChannel,
  prioritizeNews,
  fallbackCollection
};