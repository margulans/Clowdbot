// OpenClaw Dual Rating Integration
// Интеграция системы двойной оценки с OpenClaw агентом

const TelegramDualRating = require('./telegram-dual-rating.js');

class OpenClawDualRatingSystem {
    constructor(tools) {
        // OpenClaw tools
        this.message = tools.message;
        this.web_search = tools.web_search;
        this.memory_store = tools.memory_store;
        this.memory_recall = tools.memory_recall;
        
        // Dual Rating система
        this.dualRating = new TelegramDualRating(this.message, 685668909);
        
        // Настройки
        this.newsChannel = '@newsneiron';
        this.userChannel = '685668909';
    }

    // Поиск новостей с умной персонализацией
    async searchPersonalizedNews(query, category = 'AI', count = 3) {
        console.log(`🔍 Персонализированный поиск: "${query}" в категории ${category}`);
        
        try {
            // Получаем лучшие источники для данной категории
            const topSources = this.dualRating.dualRating.getTopSources(10, category);
            
            // Если есть проверенные источники, используем их в поиске
            let searchQuery = query;
            if (topSources.length > 0) {
                const sourceNames = topSources.slice(0, 3).map(s => s.name).join(' OR ');
                searchQuery += ` site:(${sourceNames.toLowerCase().replace(/\s+/g, '')})`;
            }
            
            // Выполняем поиск
            const searchResults = await this.web_search({
                query: searchQuery,
                count: count,
                freshness: 'pd'
            });
            
            if (!searchResults.results || searchResults.results.length === 0) {
                console.log('⚠️ Нет результатов, повторяем с базовым запросом');
                return await this.web_search({ query, count, freshness: 'pd' });
            }
            
            // Добавляем источники в систему рейтинга (если новые)
            searchResults.results.forEach(result => {
                if (result.siteName) {
                    this.dualRating.dualRating.addSource(
                        result.siteName, 
                        result.url,
                        category
                    );
                }
            });
            
            console.log(`✅ Найдено ${searchResults.results.length} персонализированных новостей`);
            return searchResults;
            
        } catch (error) {
            console.error('❌ Ошибка персонализированного поиска:', error);
            return await this.web_search({ query, count, freshness: 'pd' });
        }
    }

    // Создание и отправка умного дайджеста
    async createSmartDigest() {
        console.log('🤖 Создаю умный дайджест с Dual Rating...');
        
        const digestData = [];
        const topicConfig = {
            'AI': { query: 'AI artificial intelligence OpenAI Anthropic', count: 5, emoji: '🤖' },
            'Robotics': { query: 'robotics humanoid robot Boston Dynamics', count: 3, emoji: '🦾' },
            'eVTOL': { query: 'eVTOL air taxi urban aviation Joby Archer', count: 2, emoji: '✈️' },
            'Tech': { query: 'technology innovation startup', count: 3, emoji: '⚡' }
        };
        
        try {
            // Отправляем статус в личку
            await this.message({
                channel: 'telegram',
                action: 'send',
                target: this.userChannel,
                message: '🔄 Создаю умный дайджест с персонализацией...'
            });
            
            // Собираем новости по каждой теме
            for (const [category, config] of Object.entries(topicConfig)) {
                console.log(`📰 Ищу новости: ${category}`);
                
                const results = await this.searchPersonalizedNews(config.query, category, config.count);
                
                if (results.results) {
                    // Конвертируем результаты в формат дайджеста
                    const newsItems = results.results.map(item => ({
                        title: item.title,
                        content: item.description,
                        emoji: config.emoji,
                        source: {
                            name: item.siteName || 'Unknown Source',
                            url: item.url
                        },
                        expert: this.selectExpertForNews(item, category),
                        category: category
                    }));
                    
                    digestData.push(...newsItems);
                }
            }
            
            // Сортируем по важности (источники с высоким рейтингом в начало)
            digestData.sort((a, b) => {
                const sourceA = this.dualRating.dualRating.sourceRatings.get(a.source.name);
                const sourceB = this.dualRating.dualRating.sourceRatings.get(b.source.name);
                
                const ratingA = sourceA ? sourceA.averageScore : 0;
                const ratingB = sourceB ? sourceB.averageScore : 0;
                
                return ratingB - ratingA;
            });
            
            // Ограничиваем до 12 новостей
            const finalDigest = digestData.slice(0, 12);
            
            // Отправляем заголовок дайджеста
            const headerMessage = this.createDigestHeader(finalDigest);
            await this.message({
                channel: 'telegram',
                action: 'send',
                target: this.newsChannel,
                message: headerMessage
            });
            
            // Отправляем каждую новость
            for (let i = 0; i < finalDigest.length; i++) {
                await this.dualRating.sendNewsWithDualRating(finalDigest[i], this.newsChannel);
                
                // Обновляем прогресс в личке
                await this.message({
                    channel: 'telegram', 
                    action: 'send',
                    target: this.userChannel,
                    message: `📤 Отправлено ${i + 1}/${finalDigest.length} новостей`
                });
                
                // Пауза между сообщениями
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
            
            // Сохраняем данные
            await this.dualRating.saveData();
            
            // Финальное уведомление
            const stats = await this.getDigestStats(finalDigest);
            await this.message({
                channel: 'telegram',
                action: 'send', 
                target: this.userChannel,
                message: `✅ Умный дайджест готов!\n📊 ${finalDigest.length} новостей отправлено\n${stats}`
            });
            
            // Сохраняем статистику в память
            await this.memory_store({
                text: `Создан умный дайджест: ${finalDigest.length} новостей, используя Dual Rating систему`,
                category: 'fact',
                importance: 0.8
            });
            
            return {
                success: true,
                newsCount: finalDigest.length,
                categories: this.categorizeDigest(finalDigest)
            };
            
        } catch (error) {
            console.error('❌ Ошибка создания дайджеста:', error);
            
            await this.message({
                channel: 'telegram',
                action: 'send',
                target: this.userChannel, 
                message: `❌ Ошибка создания дайджеста: ${error.message}`
            });
            
            throw error;
        }
    }

    // Выбор эксперта для новости
    selectExpertForNews(newsItem, category) {
        // Получаем лучших экспертов для категории
        const topExperts = this.dualRating.dualRating.getTopExperts(5, category);
        
        if (topExperts.length === 0) {
            // Добавляем базовых экспертов, если их нет
            this.addDefaultExperts(category);
            return this.getDefaultExpertForCategory(category);
        }
        
        // 70% вероятность взять лучшего эксперта, 30% - исследовать
        if (Math.random() > 0.3 && topExperts.length > 0) {
            const bestExpert = topExperts[0];
            return {
                name: bestExpert.name,
                handle: bestExpert.handle,
                opinion: this.generateExpertOpinion(bestExpert, newsItem, category)
            };
        } else {
            // Исследование - выбираем случайного эксперта
            const allExperts = Array.from(this.dualRating.dualRating.expertRatings.values())
                .filter(e => e.category === category);
            
            if (allExperts.length > 0) {
                const randomExpert = allExperts[Math.floor(Math.random() * allExperts.length)];
                return {
                    name: randomExpert.name,
                    handle: randomExpert.handle,
                    opinion: this.generateExpertOpinion(randomExpert, newsItem, category)
                };
            }
            
            return null;
        }
    }

    // Генерация мнения эксперта
    generateExpertOpinion(expert, newsItem, category) {
        const templates = {
            'AI': [
                'Это важный шаг в развитии ИИ технологий.',
                'Интересное направление для исследований в области машинного обучения.',
                'Потенциальное влияние на будущее искусственного интеллекта значительно.'
            ],
            'Robotics': [
                'Прогресс в робототехнике открывает новые возможности.',
                'Технические решения в этой области впечатляют.',
                'Важное развитие для промышленной автоматизации.'
            ],
            'eVTOL': [
                'Перспективное направление в авиации будущего.',
                'Шаг к революции в городской мобильности.',
                'Интересные инженерные решения для воздушного транспорта.'
            ],
            'Tech': [
                'Значимое технологическое достижение.',
                'Потенциальное влияние на индустрию.',
                'Интересная инновация в технологической сфере.'
            ]
        };
        
        const categoryTemplates = templates[category] || templates['Tech'];
        return categoryTemplates[Math.floor(Math.random() * categoryTemplates.length)];
    }

    // Добавление экспертов по умолчанию
    addDefaultExperts(category) {
        const defaultExperts = {
            'AI': [
                { name: 'Андрей Карпатый', handle: '@karpathy' },
                { name: 'Сэм Альтман', handle: '@sama' },
                { name: 'Демис Хассабис', handle: '@demishassabis' }
            ],
            'Robotics': [
                { name: 'Марк Райберт', handle: '@bostondynamics' },
                { name: 'Ральф Холлис', handle: '@cmu_ri' }
            ],
            'eVTOL': [
                { name: 'JoeBen Bevirt', handle: '@jobyaviation' },
                { name: 'Vertical Magazine', handle: '@verticalmag' }
            ],
            'Tech': [
                { name: 'Илон Маск', handle: '@elonmusk' },
                { name: 'Тим Кук', handle: '@tim_cook' }
            ]
        };
        
        const experts = defaultExperts[category] || defaultExperts['Tech'];
        experts.forEach(expert => {
            this.dualRating.dualRating.addExpert(expert.name, expert.handle, category);
        });
    }

    // Получение эксперта по умолчанию для категории
    getDefaultExpertForCategory(category) {
        const defaults = {
            'AI': { name: 'Андрей Карпатый', handle: '@karpathy' },
            'Robotics': { name: 'Марк Райберт', handle: '@bostondynamics' },
            'eVTOL': { name: 'JoeBen Bevirt', handle: '@jobyaviation' },
            'Tech': { name: 'Илон Маск', handle: '@elonmusk' }
        };
        
        const defaultExpert = defaults[category] || defaults['Tech'];
        return {
            ...defaultExpert,
            opinion: 'Интересное развитие в данной области.'
        };
    }

    // Создание заголовка дайджеста
    createDigestHeader(digest) {
        const now = new Date();
        const categories = this.categorizeDigest(digest);
        
        let header = `🌅 **УМНЫЙ ДАЙДЖЕСТ** | ${now.toLocaleDateString('ru-RU')}\n`;
        header += `🤖 Multi-Armed Bandit | 📊 Dual Rating System\n\n`;
        header += `📈 **${digest.length} персонализированных новостей:**\n`;
        
        Object.entries(categories).forEach(([cat, count]) => {
            const emoji = this.getCategoryEmoji(cat);
            header += `${emoji} ${cat}: ${count} новостей\n`;
        });
        
        header += `\n💡 **Система обучается из ваших реакций!**`;
        header += `\n🔥 Огонь (+10) | 👍 Лайк (+5) | 👎 Дизлайк (-3) | 💩 Мусор (-5)`;
        
        return header;
    }

    // Категоризация дайджеста
    categorizeDigest(digest) {
        return digest.reduce((acc, item) => {
            acc[item.category] = (acc[item.category] || 0) + 1;
            return acc;
        }, {});
    }

    // Получение эмодзи для категории
    getCategoryEmoji(category) {
        const emojis = {
            'AI': '🤖',
            'Robotics': '🦾',
            'eVTOL': '✈️', 
            'Tech': '⚡',
            'Business': '💼'
        };
        return emojis[category] || '📰';
    }

    // Статистика дайджеста
    async getDigestStats(digest) {
        const categories = this.categorizeDigest(digest);
        const report = this.dualRating.dualRating.generateDualRatingReport();
        
        let stats = `📊 **Статистика:**\n`;
        stats += `🎯 Источников: ${report.sources.proven} proven, ${report.sources.candidates} candidates\n`;
        stats += `👥 Экспертов: ${report.experts.proven} proven, ${report.experts.candidates} candidates\n`;
        stats += `🤖 Алгоритм: 30% exploration, 70% exploitation`;
        
        return stats;
    }

    // Обработка реакций пользователя (для интеграции с webhook)
    async handleTelegramReaction(messageId, reaction, userId) {
        console.log(`📱 Обработка реакции: ${reaction} от ${userId}`);
        
        // Обрабатываем только реакции от целевого пользователя
        if (userId !== 685668909) {
            return null;
        }
        
        // Пока что считаем все реакции как оценку источника
        // В будущем можно добавить логику определения источник vs эксперт
        const result = await this.dualRating.handleUserReaction(
            messageId, 
            reaction, 
            userId, 
            'source'
        );
        
        if (result) {
            console.log(`✅ Рейтинг обновлен: ${result.source || result.expert} → ${result.newScore.toFixed(1)}`);
            
            // Сохраняем изменение в память
            await this.memory_store({
                text: `Пользователь оценил ${result.source || result.expert} реакцией ${reaction} (новый рейтинг: ${result.newScore.toFixed(1)})`,
                category: 'preference',
                importance: 0.6
            });
        }
        
        return result;
    }

    // Получение отчета системы
    async getSystemReport() {
        return await this.dualRating.getSystemReport();
    }

    // Команда для отчета в Telegram
    async sendSystemReportToUser() {
        const report = await this.getSystemReport();
        
        await this.message({
            channel: 'telegram',
            action: 'send',
            target: this.userChannel,
            message: report
        });
    }

    // Очистка старых данных
    async cleanupOldData() {
        const cleaned = await this.dualRating.cleanup();
        
        if (cleaned > 0) {
            await this.message({
                channel: 'telegram',
                action: 'send',
                target: this.userChannel,
                message: `🧹 Очищено ${cleaned} старых записей из системы рейтингов`
            });
        }
        
        return cleaned;
    }
}

module.exports = OpenClawDualRatingSystem;

// Пример интеграции с OpenClaw агентом
const createDualRatingIntegration = (tools) => {
    return new OpenClawDualRatingSystem(tools);
};

module.exports.createDualRatingIntegration = createDualRatingIntegration;

// Экспорт для прямого использования в агенте
module.exports.OpenClawDualRatingSystem = OpenClawDualRatingSystem;