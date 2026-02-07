#!/usr/bin/env node
/**
 * Telegram каналы парсер для гибридной системы
 * Использует публичные ссылки t.me/s/ для получения постов
 */

const { web_fetch } = require('./web-fetch-wrapper');

// Парсинг Telegram канала через публичную ссылку
async function parseTelegramChannel(channelConfig) {
  try {
    const channelName = channelConfig.name.replace('@', '').replace('https://t.me/', '');
    const publicUrl = `https://t.me/s/${channelName}`;
    
    console.log(`📱 Fetching Telegram: ${channelConfig.name} via ${publicUrl}`);
    
    // Используем web_fetch для получения страницы
    const result = await web_fetch(publicUrl);
    if (!result || !result.text) {
      throw new Error('Failed to fetch channel page');
    }
    
    // Парсим HTML страницы канала
    const posts = parseChannelHTML(result.text, channelConfig);
    
    // Фильтруем по времени (последние 24 часа)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentPosts = posts.filter(post => 
      post.published && new Date(post.published) > oneDayAgo
    );
    
    console.log(`✅ ${channelConfig.name}: ${posts.length} total, ${recentPosts.length} recent (24h)`);
    
    return recentPosts;
    
  } catch (error) {
    console.error(`❌ Telegram parse error for ${channelConfig.name}:`, error.message);
    return [];
  }
}

// Парсинг HTML страницы Telegram канала
function parseChannelHTML(html, channelConfig) {
  const posts = [];
  
  try {
    // Ищем блоки постов в HTML
    const postRegex = /<div[^>]*class="[^"]*tgme_widget_message[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;
    const matches = html.match(postRegex) || [];
    
    for (const match of matches) {
      const post = extractPostData(match, channelConfig);
      if (post) {
        posts.push(post);
      }
    }
    
  } catch (error) {
    console.error('HTML parsing error:', error.message);
  }
  
  return posts;
}

// Извлечение данных поста из HTML блока
function extractPostData(htmlBlock, channelConfig) {
  try {
    const post = {
      source: channelConfig.name,
      category: channelConfig.category,
      priority: channelConfig.priority || 10,
      telegram_channel: true,
      user_recommended: channelConfig.status === 'user_recommended'
    };
    
    // Извлекаем текст поста
    const textMatch = htmlBlock.match(/<div[^>]*class="[^"]*tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (textMatch) {
      post.content = cleanTelegramHTML(textMatch[1]);
      post.title = generateTitle(post.content);
    }
    
    // Извлекаем дату
    const timeMatch = htmlBlock.match(/<time[^>]*datetime="([^"]*)"[^>]*>/i);
    if (timeMatch) {
      post.published = timeMatch[1];
    }
    
    // Извлекаем ссылку на пост
    const linkMatch = htmlBlock.match(/<a[^>]*href="([^"]*)"[^>]*class="[^"]*tgme_widget_message_date[^"]*"[^>]*>/i);
    if (linkMatch) {
      post.url = linkMatch[1];
    }
    
    // Проверяем релевантность по категории
    if (post.content && isRelevantToCategory(post.content, channelConfig.category)) {
      return post;
    }
    
    return null;
    
  } catch (error) {
    console.error('Post extraction error:', error.message);
    return null;
  }
}

// Очистка HTML от Telegram разметки
function cleanTelegramHTML(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n') // BR в переносы строк
    .replace(/<[^>]*>/g, '') // Удаляем все HTML теги
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ') // Множественные пробелы
    .trim();
}

// Генерация заголовка из содержимого поста
function generateTitle(content) {
  if (!content) return 'Telegram Post';
  
  // Берем первое предложение или первые 50 символов
  let title = content.split(/[.!?]/, 2)[0];
  if (title.length < 20 && content.split(/[.!?]/, 2)[1]) {
    title += content.split(/[.!?]/, 2)[1];
  }
  
  if (title.length > 80) {
    title = title.substring(0, 77) + '...';
  }
  
  return title.trim();
}

// Проверка релевантности контента по категории
function isRelevantToCategory(content, category) {
  const text = content.toLowerCase();
  
  const categoryKeywords = {
    'AI': ['ии', 'искусственный интеллект', 'машинное обучение', 'нейрон', 'ai', 'artificial intelligence', 'machine learning', 'gpt', 'chatgpt', 'claude'],
    'robotics': ['робот', 'робототехника', 'автоматизация', 'robot', 'robotics', 'automation', 'дрон', 'drone'],
    'eVTOL': ['evtol', 'электрический самолет', 'воздушное такси', 'electric aircraft', 'urban air mobility', 'вертолет'],
    'business': ['бизнес', 'стартап', 'компания', 'инвестиции', 'business', 'startup', 'company', 'investment', 'венчурный'],
    'tools': ['инструмент', 'приложение', 'сервис', 'платформа', 'tool', 'app', 'service', 'platform', 'no-code', 'продуктивность'],
    'investments': ['инвестиции', 'фонд', 'акции', 'криптовалюта', 'investment', 'fund', 'crypto', 'bitcoin', 'funding']
  };
  
  const keywords = categoryKeywords[category] || [];
  if (keywords.length === 0) return true; // Если нет специфических ключевых слов, принимаем все
  
  return keywords.some(keyword => text.includes(keyword));
}

// Создание wrapper для web_fetch (чтобы не зависеть от tool напрямую)
async function web_fetch(url) {
  // В реальности здесь должен быть вызов web_fetch tool
  // Пока заглушка для тестирования
  console.log(`🌐 Would fetch: ${url}`);
  
  return {
    text: `<div class="tgme_widget_message_wrap js-widget_message_wrap">
      <div class="tgme_widget_message text_not_supported_wrap js-widget_message" data-post="channel/123">
        <div class="tgme_widget_message_bubble">
          <div class="tgme_widget_message_author accent_color">
            <a class="tgme_widget_message_owner_name" href="https://t.me/test">
              <span dir="auto">Test Channel <i class="emoji" style="background-image:url('//telegram.org/img/emoji/40/F09F94A5.png')"><b>🔥</b></i></span>
            </a>
          </div>
          <div class="tgme_widget_message_text js-message_text" dir="auto">
            Новый прорыв в области искусственного интеллекта! OpenAI анонсировала улучшенную модель GPT-5 с поддержкой мультимодальности.
            <br><br>
            Ключевые особенности:<br>
            • Понимание изображений и видео<br>  
            • Улучшенные математические способности<br>
            • Снижение галлюцинаций на 40%<br>
            <br>
            #ИИ #OpenAI #GPT5
          </div>
          <div class="tgme_widget_message_footer compact js-message_footer">
            <div class="tgme_widget_message_info short js-message_info">
              <span class="tgme_widget_message_views">1.2K</span>
              <span class="copyonly"> views</span>
              <span class="tgme_widget_message_meta">
                <a class="tgme_widget_message_date" href="https://t.me/test/123">
                  <time datetime="2026-02-05T09:00:00+00:00" title="Feb 05, 2026 at 09:00">09:00</time>
                </a>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>`
  };
}

// Парсинг нескольких Telegram каналов
async function parseMultipleTelegramChannels(channelConfigs, concurrent = 2) {
  console.log(`📱 Parsing ${channelConfigs.length} Telegram channels (max ${concurrent} concurrent)`);
  
  const results = [];
  
  // Обрабатываем по батчам (Telegram может блокировать при многих запросах)
  for (let i = 0; i < channelConfigs.length; i += concurrent) {
    const batch = channelConfigs.slice(i, i + concurrent);
    
    const batchPromises = batch.map(parseTelegramChannel);
    const batchResults = await Promise.allSettled(batchPromises);
    
    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      const channelConfig = batch[j];
      
      if (result.status === 'fulfilled') {
        results.push(...result.value);
        console.log(`✅ Telegram processed: ${channelConfig.name}`);
      } else {
        console.error(`❌ Telegram failed: ${channelConfig.name} - ${result.reason?.message}`);
      }
    }
    
    // Пауза между батчами чтобы не нагружать Telegram
    if (i + concurrent < channelConfigs.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`📊 Telegram Summary: ${results.length} total posts from ${channelConfigs.length} channels`);
  return results;
}

// CLI интерфейс
if (require.main === module) {
  const testChannels = [
    {name: "@serge_ai", category: "AI", priority: 10, status: "proven"},
    {name: "@data_secrets", category: "AI", priority: 10, status: "exploration"}
  ];
  
  const command = process.argv[2] || 'test';
  
  if (command === 'test') {
    console.log('🧪 Testing Telegram parser...');
    parseMultipleTelegramChannels(testChannels)
      .then(posts => {
        console.log('\n🏆 Sample posts:');
        posts.slice(0, 3).forEach((post, i) => {
          console.log(`${i+1}. ${post.title}`);
          console.log(`   Source: ${post.source} | Category: ${post.category}`);
          console.log(`   Content preview: ${post.content.substring(0, 100)}...`);
          console.log('');
        });
      })
      .catch(console.error);
  } else if (command === 'single' && process.argv[3]) {
    const channel = process.argv[3];
    parseTelegramChannel({
      name: channel,
      category: "test", 
      priority: 5
    }).then(console.log).catch(console.error);
  } else {
    console.log('Usage:');
    console.log('  node telegram-parser.js test              # Test with sample channels');
    console.log('  node telegram-parser.js single @channel   # Test single channel');
  }
}

module.exports = {
  parseTelegramChannel,
  parseMultipleTelegramChannels,
  parseChannelHTML,
  extractPostData,
  cleanTelegramHTML,
  generateTitle,
  isRelevantToCategory
};