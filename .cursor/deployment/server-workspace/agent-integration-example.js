// Пример интеграции Typing Indicators в OpenClaw агента
// Копируйте эти функции в основной код агента

const { createTypingIndicator, withProgress, Templates } = require('./typing-helper.js');

// =============================================================================
// ИНТЕГРАЦИЯ В ФУНКЦИИ АГЕНТА
// =============================================================================

/**
 * Поиск новостей с прогрессом
 * Использовать вместо обычного web_search
 */
async function searchNewsWithProgress(query, count = 5, target = '685668909') {
    return await withProgress(
        message,
        target,
        'news-search',
        async (indicator) => {
            await indicator.update(`🔍 Ищу: "${query}"...`);
            const results = await web_search({ query, count, freshness: 'pd' });
            
            await indicator.update('📊 Фильтрую результаты...');
            const filtered = results.results?.filter(r => r.title && r.description) || [];
            
            return {
                results: filtered,
                count: filtered.length,
                query: query
            };
        },
        {
            startMessage: '🚀 Начинаю поиск новостей...',
            successMessage: `✅ Найдено новостей по "${query}"`,
            autoDelete: true
        }
    );
}

/**
 * Проверка подключения к Mac с прогрессом  
 * Использовать вместо обычной проверки nodes
 */
async function checkMacConnectionWithProgress(target = '685668909') {
    const indicator = createTypingIndicator(message, target);
    
    try {
        await indicator.start(Templates.MAC_CONNECTION.start);
        
        await indicator.update(Templates.MAC_CONNECTION.checking);
        const nodesStatus = await nodes({ action: 'status' });
        
        await indicator.update(Templates.MAC_CONNECTION.connecting);
        const macNode = nodesStatus.nodes?.find(n => n.displayName === 'mac-files');
        
        if (macNode?.connected) {
            await indicator.finish(Templates.MAC_CONNECTION.success);
            return { 
                connected: true, 
                node: macNode,
                ip: macNode.remoteIp 
            };
        } else {
            await indicator.error(Templates.MAC_CONNECTION.error);
            return { 
                connected: false, 
                node: macNode,
                lastSeen: macNode?.lastSeen || 'unknown'
            };
        }
        
    } catch (error) {
        await indicator.error(`❌ Ошибка проверки Mac: ${error.message}`);
        return { connected: false, error: error.message };
    }
}

/**
 * Генерация дайджеста с полным прогрессом
 * Использовать в heartbeat или по команде /digest
 */
async function generateDigestWithProgress(target = '685668909') {
    const indicator = createTypingIndicator(message, target);
    
    try {
        await indicator.start('📰 Создаю дайджест...');
        
        // Этап 1: Поиск новостей
        await indicator.update('🔍 Сканирую источники ИИ новостей...');
        const aiNews = await web_search({ 
            query: 'AI artificial intelligence news', 
            count: 4, 
            freshness: 'pd' 
        });
        
        await indicator.update('🦾 Сканирую робототехнику...');
        const roboticsNews = await web_search({ 
            query: 'robotics humanoid robot news', 
            count: 3, 
            freshness: 'pd' 
        });
        
        await indicator.update('✈️ Сканирую eVTOL новости...');  
        const evtolNews = await web_search({ 
            query: 'eVTOL air taxi news', 
            count: 2, 
            freshness: 'pd' 
        });
        
        // Этап 2: Объединение и фильтрация
        await indicator.update('📊 Применяю приоритеты и фильтры...');
        const allNews = [
            ...aiNews.results || [],
            ...roboticsNews.results || [],
            ...evtolNews.results || []
        ].filter(news => news.title && news.description);
        
        // Этап 3: Форматирование  
        await indicator.update('✍️ Форматирую новости...');
        const formattedNews = allNews.slice(0, 8).map((news, i) => {
            const category = i < 4 ? '🤖' : i < 7 ? '🦾' : '✈️';
            return {
                text: `${category} **${news.title}**\n\n${news.description}\n\n📰 ${news.siteName} — ${news.url}`,
                source: news.siteName,
                category: category
            };
        });
        
        // Этап 4: Отправка в канал
        await indicator.update(`📤 Отправляю ${formattedNews.length} новостей в @newsneiron...`);
        
        // Отправляем заголовок дайджеста
        await message({
            channel: 'telegram',
            action: 'send', 
            target: '@newsneiron',
            message: `🌅 **ДАЙДЖЕСТ** | ${new Date().toLocaleDateString('ru-RU')}\n📊 ${formattedNews.length} новостей | 🎯 С индикатором прогресса`
        });
        
        // Отправляем новости по одной
        for (let i = 0; i < formattedNews.length; i++) {
            await message({
                channel: 'telegram',
                action: 'send',
                target: '@newsneiron', 
                message: formattedNews[i].text
            });
            
            // Обновляем прогресс
            await indicator.update(`📤 Отправлено ${i + 1}/${formattedNews.length} новостей...`);
            
            // Небольшая пауза между сообщениями
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        await indicator.finish(`✅ Дайджест готов! Отправлено ${formattedNews.length} новостей`);
        
        return {
            success: true,
            newsCount: formattedNews.length,
            categories: {
                ai: formattedNews.filter(n => n.category === '🤖').length,
                robotics: formattedNews.filter(n => n.category === '🦾').length,
                evtol: formattedNews.filter(n => n.category === '✈️').length
            }
        };
        
    } catch (error) {
        await indicator.error('❌ Ошибка создания дайджеста');
        console.error('Digest generation error:', error);
        throw error;
    }
}

/**
 * Улучшенная heartbeat функция с прогрессом
 * Использовать в HEARTBEAT.md
 */
async function smartHeartbeatCheck(target = '685668909') {
    // Проверяем только если не во время тишины
    const now = new Date();
    const hour = now.getUTCHours();
    
    // Тихие часы: 23:00-08:00 UTC
    if (hour >= 23 || hour < 8) {
        console.log('🌙 Тихие часы - пропуск heartbeat');
        return;
    }
    
    const indicator = createTypingIndicator(message, target);
    let alertSent = false;
    
    try {
        await indicator.start('🔄 Проверяю новости...');
        
        // Проверяем срочные ИИ новости
        await indicator.update('🔍 Сканирую срочные ИИ новости...');
        const urgentAI = await web_search({
            query: 'breaking AI news urgent today',
            count: 3,
            freshness: 'pd'
        });
        
        // Проверяем важные анонсы
        await indicator.update('📢 Проверяю важные анонсы...');
        const announcements = await web_search({
            query: 'OpenAI Anthropic Google AI announcement release',
            count: 2, 
            freshness: 'pd'
        });
        
        const urgentNews = [
            ...(urgentAI.results || []),
            ...(announcements.results || [])
        ].filter(news => {
            // Фильтр срочности по ключевым словам
            const urgentKeywords = ['breaking', 'urgent', 'announced', 'released', 'launched'];
            const text = (news.title + ' ' + news.description).toLowerCase();
            return urgentKeywords.some(keyword => text.includes(keyword));
        });
        
        if (urgentNews.length > 0) {
            await indicator.update(`🚨 Найдено ${urgentNews.length} срочных новостей...`);
            
            // Отправляем в канал
            await message({
                channel: 'telegram',
                action: 'send',
                target: '@newsneiron', 
                message: `🚨 **СРОЧНЫЕ НОВОСТИ** | ${now.toISOString().slice(11, 16)} UTC\n🔥 Найдено ${urgentNews.length} важных обновлений`
            });
            
            for (const news of urgentNews.slice(0, 3)) {
                await message({
                    channel: 'telegram',
                    action: 'send',
                    target: '@newsneiron',
                    message: `🚨 **${news.title}**\n\n${news.description}\n\n📰 ${news.siteName} — ${news.url}`
                });
            }
            
            alertSent = true;
        }
        
        // Финальный статус
        if (alertSent) {
            await indicator.finish(`✅ Отправлено ${urgentNews.length} срочных новостей`);
        } else {
            await indicator.finish('✅ Новых срочных новостей нет', true, 2000);
        }
        
        return {
            urgentFound: urgentNews.length,
            alertSent: alertSent,
            timestamp: now.toISOString()
        };
        
    } catch (error) {
        await indicator.error('❌ Ошибка проверки новостей');
        console.error('Heartbeat error:', error);
        return { error: error.message, timestamp: now.toISOString() };
    }
}

// =============================================================================
// ИНТЕГРАЦИЯ С КОМАНДАМИ
// =============================================================================

/**
 * Обработчик команды /digest с прогрессом
 */
async function handleDigestCommand(userId = '685668909') {
    try {
        const result = await generateDigestWithProgress(userId);
        
        // Отправляем подтверждение в личку
        await message({
            channel: 'telegram',
            action: 'send',
            target: userId,
            message: `✅ Дайджест отправлен в @newsneiron\n📊 ${result.newsCount} новостей: ${result.categories.ai}🤖 ${result.categories.robotics}🦾 ${result.categories.evtol}✈️`
        });
        
    } catch (error) {
        await message({
            channel: 'telegram', 
            action: 'send',
            target: userId,
            message: `❌ Ошибка создания дайджеста: ${error.message}`
        });
    }
}

/**
 * Обработчик команды /mac с прогрессом
 */
async function handleMacCommand(userId = '685668909') {
    const result = await checkMacConnectionWithProgress(userId);
    
    if (result.connected) {
        await message({
            channel: 'telegram',
            action: 'send', 
            target: userId,
            message: `✅ Mac подключен\n🌐 IP: ${result.ip}\n📁 Доступ к файлам активен`
        });
    } else {
        await message({
            channel: 'telegram',
            action: 'send',
            target: userId, 
            message: `❌ Mac недоступен\n⏱️ Последний раз в сети: ${result.lastSeen || 'неизвестно'}\n\n🔧 Попробуйте:\n1. Включить Mac\n2. Перезапустить Tailscale\n3. Перезапустить OpenClaw node`
        });
    }
}

// =============================================================================
// ЭКСПОРТ ДЛЯ ИСПОЛЬЗОВАНИЯ В АГЕНТЕ
// =============================================================================

module.exports = {
    searchNewsWithProgress,
    checkMacConnectionWithProgress, 
    generateDigestWithProgress,
    smartHeartbeatCheck,
    handleDigestCommand,
    handleMacCommand
};

// =============================================================================
// ПРИМЕР ИСПОЛЬЗОВАНИЯ В ОСНОВНОМ КОДЕ АГЕНТА
// =============================================================================

/*
// В начале файла агента:
const {
    searchNewsWithProgress,
    generateDigestWithProgress,
    smartHeartbeatCheck
} = require('./agent-integration-example.js');

// В обработчике команд:
if (userMessage === '/digest') {
    await generateDigestWithProgress('685668909');
    return;
}

if (userMessage === '/mac') {
    await checkMacConnectionWithProgress('685668909');
    return;
}

// В heartbeat функции:
async function heartbeatCheck() {
    return await smartHeartbeatCheck('685668909');
}

// В функциях поиска:
async function findAINews() {
    const results = await searchNewsWithProgress('AI artificial intelligence', 5);
    return results.results;
}
*/