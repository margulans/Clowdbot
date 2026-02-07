#!/usr/bin/env node
/**
 * RSS парсер для гибридной новостной системы
 */

const https = require('https');
const http = require('http');

// Простой RSS/XML парсер (без внешних зависимостей)
function parseXML(xmlString) {
  const items = [];
  
  // Простой regex парсинг RSS/Atom элементов
  const itemRegex = /<(?:item|entry)[\s\S]*?<\/(?:item|entry)>/gi;
  const matches = xmlString.match(itemRegex) || [];
  
  for (const match of matches) {
    const item = {};
    
    // Извлекаем основные поля
    const titleMatch = match.match(/<(?:title)(?:[^>]*)?>([\s\S]*?)<\/(?:title)>/i);
    const linkMatch = match.match(/<(?:link)(?:[^>]*)?(?:href="([^"]*)"[^>]*)?>([\s\S]*?)<\/(?:link)>|<link[^>]*href="([^"]*)"[^>]*\/?>|<link[^>]*>([\s\S]*?)<\/link>/i);
    const descMatch = match.match(/<(?:description|summary|content)(?:[^>]*)?>([\s\S]*?)<\/(?:description|summary|content)>/i);
    const dateMatch = match.match(/<(?:pubDate|published|updated)(?:[^>]*)?>([\s\S]*?)<\/(?:pubDate|published|updated)>/i);
    
    if (titleMatch) {
      item.title = cleanHTML(titleMatch[1]).trim();
    }
    
    if (linkMatch) {
      item.link = (linkMatch[1] || linkMatch[3] || linkMatch[2] || linkMatch[4] || '').trim();
    }
    
    if (descMatch) {
      item.description = cleanHTML(descMatch[1]).trim();
    }
    
    if (dateMatch) {
      item.pubDate = new Date(dateMatch[1].trim());
    }
    
    if (item.title && item.link) {
      items.push(item);
    }
  }
  
  return items;
}

// Очистка HTML тегов и entities
function cleanHTML(text) {
  return text
    .replace(/<[^>]*>/g, '') // Удаляем HTML теги
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' '); // Множественные пробелы в один
}

// HTTP клиент для получения RSS
function fetchRSS(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    
    const req = client.get(url, {
      headers: {
        'User-Agent': 'OpenClaw News Aggregator/1.0',
        'Accept': 'application/rss+xml, application/xml, text/xml'
      },
      timeout: 10000
    }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.on('error', reject);
  });
}

// Основная функция парсинга RSS канала
async function parseRSSFeed(feedConfig) {
  try {
    console.log(`📡 Fetching RSS: ${feedConfig.name} (${feedConfig.url})`);
    
    const xmlData = await fetchRSS(feedConfig.url);
    const items = parseXML(xmlData);
    
    console.log(`✅ ${feedConfig.name}: Found ${items.length} items`);
    
    // Фильтруем по свежести (последние 24 часа)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentItems = items.filter(item => 
      item.pubDate && item.pubDate > oneDayAgo
    );
    
    console.log(`🔍 ${feedConfig.name}: ${recentItems.length} recent items (24h)`);
    
    // Преобразуем в стандартный формат новостей
    const articles = recentItems.map(item => ({
      title: item.title,
      url: item.link,
      content: item.description || '',
      published: item.pubDate ? item.pubDate.toISOString() : new Date().toISOString(),
      source: feedConfig.name,
      category: feedConfig.category,
      priority: feedConfig.priority || 5,
      keywords: feedConfig.keywords || [],
      rss_source: true
    }));
    
    // Дополнительная фильтрация по ключевым словам
    const relevantArticles = articles.filter(article => {
      if (!feedConfig.keywords || feedConfig.keywords.length === 0) return true;
      
      const text = (article.title + ' ' + article.content).toLowerCase();
      return feedConfig.keywords.some(keyword => 
        text.includes(keyword.toLowerCase())
      );
    });
    
    console.log(`🎯 ${feedConfig.name}: ${relevantArticles.length} relevant articles`);
    
    return relevantArticles;
    
  } catch (error) {
    console.error(`❌ RSS Error for ${feedConfig.name}:`, error.message);
    return [];
  }
}

// Парсинг нескольких RSS каналов
async function parseMultipleFeeds(feedConfigs, concurrent = 3) {
  console.log(`📡 Parsing ${feedConfigs.length} RSS feeds (max ${concurrent} concurrent)`);
  
  const results = [];
  
  // Обрабатываем по батчам для контроля нагрузки
  for (let i = 0; i < feedConfigs.length; i += concurrent) {
    const batch = feedConfigs.slice(i, i + concurrent);
    
    const batchPromises = batch.map(parseRSSFeed);
    const batchResults = await Promise.allSettled(batchPromises);
    
    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      const feedConfig = batch[j];
      
      if (result.status === 'fulfilled') {
        results.push(...result.value);
        console.log(`✅ Batch processed: ${feedConfig.name}`);
      } else {
        console.error(`❌ Batch failed: ${feedConfig.name} - ${result.reason?.message}`);
      }
    }
  }
  
  console.log(`📊 RSS Summary: ${results.length} total articles from ${feedConfigs.length} feeds`);
  return results;
}

// CLI интерфейс
if (require.main === module) {
  const testFeeds = [
    {
      name: "MIT Technology Review",
      url: "https://www.technologyreview.com/feed/",
      category: "AI",
      priority: 9,
      keywords: ["artificial intelligence", "machine learning", "AI"]
    },
    {
      name: "TechCrunch",
      url: "https://techcrunch.com/feed/",
      category: "technology", 
      priority: 7,
      keywords: ["startup", "tech", "AI"]
    }
  ];
  
  const command = process.argv[2] || 'test';
  
  if (command === 'test') {
    console.log('🧪 Testing RSS parser...');
    parseMultipleFeeds(testFeeds)
      .then(articles => {
        console.log('\n🏆 Sample articles:');
        articles.slice(0, 3).forEach((article, i) => {
          console.log(`${i+1}. ${article.title}`);
          console.log(`   Source: ${article.source} | Category: ${article.category}`);
          console.log(`   URL: ${article.url}`);
          console.log('');
        });
      })
      .catch(console.error);
  } else if (command === 'single' && process.argv[3]) {
    const url = process.argv[3];
    parseRSSFeed({
      name: "Test Feed",
      url: url,
      category: "test",
      priority: 5,
      keywords: []
    }).then(console.log).catch(console.error);
  } else {
    console.log('Usage:');
    console.log('  node rss-parser.js test          # Test with sample feeds');
    console.log('  node rss-parser.js single <url>  # Test single RSS URL');
  }
}

module.exports = {
  parseRSSFeed,
  parseMultipleFeeds,
  parseXML,
  fetchRSS,
  cleanHTML
};