// Интеграция Multi-Armed Bandit с системой дайджестов OpenClaw

const NewsSourceManager = require('./news-source-manager.js');

class SmartDigestSystem {
    constructor() {
        this.sourceManager = new NewsSourceManager();
        this.initialized = false;
    }

    async initialize() {
        if (!this.initialized) {
            await this.sourceManager.initialize();
            this.initialized = true;
        }
    }

    // Обработка реакции пользователя из канала Telegram
    async handleTelegramReaction(messageText, reaction, userId) {
        await this.initialize();
        
        // Извлекаем название источника из сообщения
        const sourceName = this.extractSourceName(messageText);
        
        if (sourceName && userId === 685668909) {
            await this.sourceManager.handleUserReaction(sourceName, reaction, userId);
            
            console.log(`🎯 Обновлен рейтинг источника ${sourceName} на основе реакции ${reaction}`);
            
            return {
                success: true,
                source: sourceName,
                reaction: reaction,
                stats: this.sourceManager.getSourceStats()
            };
        }
        
        return { success: false, reason: 'Source not found or wrong user' };
    }

    // Извлечение названия источника из текста новости
    extractSourceName(messageText) {
        // Ищем строку "📰 Название — ссылка"
        const sourceMatch = messageText.match(/📰\s*([^—\n]+)/);
        if (sourceMatch) {
            return sourceMatch[1].trim();
        }
        
        // Альтернативные форматы
        const altMatch = messageText.match(/Источник:\s*([^\n]+)/i);
        if (altMatch) {
            return altMatch[1].trim();
        }
        
        return null;
    }

    // Умный выбор источников для дайджеста
    async selectSourcesForDigest(availableSources, targetCount = 10) {
        await this.initialize();
        
        const selection = await this.sourceManager.selectSourcesForDigest(availableSources, targetCount);
        
        // Логирование для отладки
        console.log(`🤖 Выбрано источников: ${selection.sources.length}`);
        console.log(`🎯 Эксплуатация (${selection.exploitation.length}): ${selection.exploitation.slice(0,3).join(', ')}...`);
        console.log(`🔍 Исследование (${selection.exploration.length}): ${selection.exploration.slice(0,3).join(', ')}...`);
        
        return selection;
    }

    // Получить приоритетные источники для определенной категории
    async getTopSourcesForCategory(category, count = 5) {
        await this.initialize();
        
        const stats = this.sourceManager.getSourceStats();
        const categorySources = stats.topSources
            .filter(source => source.category === category || !category)
            .slice(0, count);
            
        return categorySources;
    }

    // Генерация отчета о системе
    async generateSystemReport() {
        await this.initialize();
        
        const recommendations = this.sourceManager.getOptimizationRecommendations();
        const stats = recommendations.stats;
        
        const report = {
            timestamp: new Date().toISOString(),
            health: recommendations.health,
            statistics: {
                totalSources: stats.total,
                proven: stats.byStatus.proven,
                candidates: stats.byStatus.candidate,
                rejected: stats.byStatus.rejected,
                topSources: stats.topSources.slice(0, 5)
            },
            recommendations: recommendations.recommendations,
            performance: {
                explorationRate: 30,
                exploitationRate: 70,
                adaptiveness: recommendations.health.score >= 60 ? 'good' : 'improving'
            }
        };
        
        return report;
    }

    // Симуляция работы системы (для тестирования)
    async simulateDigestGeneration(newsData) {
        const availableSources = newsData.map(news => news.source);
        const selection = await this.selectSourcesForDigest(availableSources, 8);
        
        // Фильтруем новости по выбранным источникам
        const selectedNews = newsData.filter(news => 
            selection.sources.includes(news.source)
        );
        
        // Сортируем: сначала эксплуатация (лучшие), потом исследование
        const sortedNews = [
            ...selectedNews.filter(news => selection.exploitation.includes(news.source)),
            ...selectedNews.filter(news => selection.exploration.includes(news.source))
        ];
        
        return {
            news: sortedNews,
            meta: {
                totalAvailable: newsData.length,
                selected: sortedNews.length,
                exploitation: selection.exploitation.length,
                exploration: selection.exploration.length,
                algorithm: 'multi-armed-bandit'
            }
        };
    }
}

// Пример интеграции с OpenClaw
class OpenClawDigestIntegration {
    constructor() {
        this.digestSystem = new SmartDigestSystem();
    }

    // Обработка реакции из webhook Telegram
    async handleWebhookReaction(update) {
        if (update.callback_query && update.callback_query.data.startsWith('r:')) {
            const [prefix, reactionType, chatId, messageId] = update.callback_query.data.split(':');
            
            const reactionMap = {
                'e': '🔥',  // excellent 
                'l': '👍',  // like
                'd': '👎',  // dislike  
                't': '💩'   // trash
            };
            
            const reaction = reactionMap[reactionType];
            const userId = update.callback_query.from.id;
            const messageText = update.callback_query.message.text;
            
            return await this.digestSystem.handleTelegramReaction(messageText, reaction, userId);
        }
        
        return { success: false, reason: 'Not a reaction callback' };
    }

    // Генерация дайджеста с учетом Multi-Armed Bandit
    async generateSmartDigest(rawNewsData) {
        const result = await this.digestSystem.simulateDigestGeneration(rawNewsData);
        
        // Форматирование для отправки в Telegram
        const digestMessages = result.news.map(news => ({
            text: this.formatNewsMessage(news),
            source: news.source,
            isExploration: result.meta.exploration > 0
        }));
        
        return {
            messages: digestMessages,
            meta: result.meta,
            report: await this.digestSystem.generateSystemReport()
        };
    }

    formatNewsMessage(news) {
        return `${news.emoji} **${news.title}**

${news.description}

💭 **Экспертное мнение:** ${news.expertOpinion}

📰 ${news.source} — ${news.url}`;
    }
}

module.exports = {
    SmartDigestSystem,
    OpenClawDigestIntegration
};

// Тест интеграции
if (require.main === module) {
    async function testIntegration() {
        console.log('🔗 Тестирование интеграции с OpenClaw...');
        
        const integration = new OpenClawDigestIntegration();
        
        // Пример данных новостей
        const sampleNews = [
            {
                title: 'OpenAI выпустила GPT-5',
                description: 'Новая модель показывает впечатляющие результаты...',
                expertOpinion: 'Это прорыв в области ИИ',
                source: 'OpenAI Blog',
                url: 'openai.com/gpt5',
                emoji: '🤖'
            },
            {
                title: 'Anthropic обновила Claude',
                description: 'Улучшены возможности кодирования...',
                expertOpinion: 'Конкуренция растет',
                source: 'Anthropic',
                url: 'anthropic.com/claude',
                emoji: '🤖'
            },
            {
                title: 'Новый робот от Boston Dynamics',
                description: 'Гуманоидный робот Atlas получил обновления...',
                expertOpinion: 'Коммерциализация близко',
                source: 'Boston Dynamics',
                url: 'bostondynamics.com/atlas',
                emoji: '🦾'
            }
        ];
        
        const digest = await integration.generateSmartDigest(sampleNews);
        
        console.log('\n📊 Результат умного дайджеста:');
        console.log(`Всего новостей: ${digest.messages.length}`);
        console.log(`Эксплуатация: ${digest.meta.exploitation}`);
        console.log(`Исследование: ${digest.meta.exploration}`);
        console.log(`Здоровье системы: ${digest.report.health.score}/100`);
        
        console.log('\n✅ Интеграция успешно протестирована!');
    }
    
    testIntegration().catch(console.error);
}