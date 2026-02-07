// Dual Rating System - Раздельная оценка источников и экспертов
// Интеграция с Multi-Armed Bandit для персонализации

class DualRatingManager {
    constructor() {
        this.userId = 685668909; // ID пользователя для фильтрации реакций
        
        // Рейтинги источников
        this.sourceRatings = new Map();
        
        // Рейтинги экспертов
        this.expertRatings = new Map();
        
        // Маппинг реакций на баллы
        this.reactionScores = {
            '🔥': 10,  // Огонь - отлично
            '👍': 5,   // Лайк - нравится
            '👎': -3,  // Дизлайк - не нравится  
            '💩': -5   // Мусор - плохо
        };
        
        // История сообщений для связи реакций
        this.messageHistory = new Map();
    }

    // Регистрация сообщения с источником и экспертом
    registerMessage(messageId, chatId, sourceInfo, expertInfo = null) {
        this.messageHistory.set(messageId, {
            chatId: chatId,
            source: sourceInfo,
            expert: expertInfo,
            timestamp: Date.now()
        });
        
        console.log(`📝 Зарегистрировано сообщение ${messageId}:`, sourceInfo, expertInfo);
    }

    // Добавление или обновление источника
    addSource(sourceName, sourceUrl, category = 'general') {
        if (!this.sourceRatings.has(sourceName)) {
            this.sourceRatings.set(sourceName, {
                name: sourceName,
                url: sourceUrl,
                category: category,
                totalScore: 0,
                reactionsCount: 0,
                reactions: [],
                averageScore: 0,
                status: 'candidate', // candidate, proven, rejected
                lastReaction: null
            });
        }
    }

    // Добавление или обновление эксперта
    addExpert(expertName, expertHandle = '', category = 'general') {
        if (!this.expertRatings.has(expertName)) {
            this.expertRatings.set(expertName, {
                name: expertName,
                handle: expertHandle,
                category: category,
                totalScore: 0,
                reactionsCount: 0,
                reactions: [],
                averageScore: 0,
                status: 'candidate', // candidate, proven, rejected
                lastReaction: null
            });
        }
    }

    // Обработка реакции пользователя на сообщение
    processReaction(messageId, reaction, userId, reactionType = 'source') {
        // Фильтруем только реакции нужного пользователя
        if (userId !== this.userId) {
            console.log(`⏭️ Игнорирую реакцию от ${userId} (не целевой пользователь)`);
            return null;
        }

        const messageInfo = this.messageHistory.get(messageId);
        if (!messageInfo) {
            console.warn(`⚠️ Сообщение ${messageId} не найдено в истории`);
            return null;
        }

        const score = this.reactionScores[reaction] || 0;
        
        // Обновляем рейтинг в зависимости от типа реакции
        if (reactionType === 'source' && messageInfo.source) {
            return this.updateSourceRating(messageInfo.source.name, reaction, score, userId);
        } else if (reactionType === 'expert' && messageInfo.expert) {
            return this.updateExpertRating(messageInfo.expert.name, reaction, score, userId);
        }
        
        return null;
    }

    // Обновление рейтинга источника
    updateSourceRating(sourceName, reaction, score, userId) {
        const source = this.sourceRatings.get(sourceName);
        if (!source) {
            console.warn(`⚠️ Источник ${sourceName} не найден`);
            return null;
        }

        // Добавляем реакцию
        source.reactions.push({
            reaction: reaction,
            score: score,
            userId: userId,
            timestamp: Date.now()
        });

        // Обновляем статистику
        source.totalScore += score;
        source.reactionsCount += 1;
        source.averageScore = source.totalScore / source.reactionsCount;
        source.lastReaction = Date.now();

        // Обновляем статус на основе среднего рейтинга
        this.updateSourceStatus(sourceName);

        console.log(`📊 Источник ${sourceName}: ${reaction} (${score}), средний: ${source.averageScore.toFixed(1)}, статус: ${source.status}`);
        
        return {
            source: sourceName,
            newScore: source.averageScore,
            status: source.status,
            totalReactions: source.reactionsCount
        };
    }

    // Обновление рейтинга эксперта
    updateExpertRating(expertName, reaction, score, userId) {
        const expert = this.expertRatings.get(expertName);
        if (!expert) {
            console.warn(`⚠️ Эксперт ${expertName} не найден`);
            return null;
        }

        // Добавляем реакцию
        expert.reactions.push({
            reaction: reaction,
            score: score,
            userId: userId,
            timestamp: Date.now()
        });

        // Обновляем статистику
        expert.totalScore += score;
        expert.reactionsCount += 1;
        expert.averageScore = expert.totalScore / expert.reactionsCount;
        expert.lastReaction = Date.now();

        // Обновляем статус на основе среднего рейтинга
        this.updateExpertStatus(expertName);

        console.log(`👤 Эксперт ${expertName}: ${reaction} (${score}), средний: ${expert.averageScore.toFixed(1)}, статус: ${expert.status}`);
        
        return {
            expert: expertName,
            newScore: expert.averageScore,
            status: expert.status,
            totalReactions: expert.reactionsCount
        };
    }

    // Обновление статуса источника
    updateSourceStatus(sourceName) {
        const source = this.sourceRatings.get(sourceName);
        if (!source || source.reactionsCount < 3) return; // Минимум 3 реакции

        if (source.averageScore >= 7) {
            source.status = 'proven';
        } else if (source.averageScore <= -2) {
            source.status = 'rejected';
        } else {
            source.status = 'candidate';
        }
    }

    // Обновление статуса эксперта
    updateExpertStatus(expertName) {
        const expert = this.expertRatings.get(expertName);
        if (!expert || expert.reactionsCount < 3) return; // Минимум 3 реакции

        if (expert.averageScore >= 7) {
            expert.status = 'proven';
        } else if (expert.averageScore <= -2) {
            expert.status = 'rejected';
        } else {
            expert.status = 'candidate';
        }
    }

    // Получить топ источники
    getTopSources(limit = 10, category = null) {
        return Array.from(this.sourceRatings.values())
            .filter(s => !category || s.category === category)
            .filter(s => s.reactionsCount > 0)
            .sort((a, b) => b.averageScore - a.averageScore)
            .slice(0, limit);
    }

    // Получить топ экспертов
    getTopExperts(limit = 10, category = null) {
        return Array.from(this.expertRatings.values())
            .filter(e => !category || e.category === category)
            .filter(e => e.reactionsCount > 0)
            .sort((a, b) => b.averageScore - a.averageScore)
            .slice(0, limit);
    }

    // Multi-Armed Bandit для источников
    selectSourcesWithBandit(availableSources, targetCount = 10, explorationRate = 0.3) {
        const activeSources = Array.from(this.sourceRatings.values())
            .filter(s => availableSources.includes(s.name))
            .filter(s => s.status !== 'rejected');

        const explorationCount = Math.floor(targetCount * explorationRate);
        const exploitationCount = targetCount - explorationCount;

        // Эксплуатация: лучшие по рейтингу
        const topSources = activeSources
            .sort((a, b) => b.averageScore - a.averageScore)
            .slice(0, exploitationCount);

        // Исследование: новые или мало оцененные
        const unexplored = activeSources
            .filter(s => !topSources.includes(s))
            .sort((a, b) => a.reactionsCount - b.reactionsCount)
            .slice(0, explorationCount);

        const selected = [...topSources, ...unexplored];

        return {
            sources: selected.map(s => s.name),
            exploitation: topSources.map(s => s.name),
            exploration: unexplored.map(s => s.name),
            stats: {
                totalAvailable: activeSources.length,
                selected: selected.length,
                exploitationCount: topSources.length,
                explorationCount: unexplored.length
            }
        };
    }

    // Multi-Armed Bandit для экспертов
    selectExpertsWithBandit(availableExperts, targetCount = 5, explorationRate = 0.3) {
        const activeExperts = Array.from(this.expertRatings.values())
            .filter(e => availableExperts.includes(e.name))
            .filter(e => e.status !== 'rejected');

        const explorationCount = Math.floor(targetCount * explorationRate);
        const exploitationCount = targetCount - explorationCount;

        // Эксплуатация: лучшие по рейтингу
        const topExperts = activeExperts
            .sort((a, b) => b.averageScore - a.averageScore)
            .slice(0, exploitationCount);

        // Исследование: новые или мало оцененные
        const unexplored = activeExperts
            .filter(e => !topExperts.includes(e))
            .sort((a, b) => a.reactionsCount - b.reactionsCount)
            .slice(0, explorationCount);

        const selected = [...topExperts, ...unexplored];

        return {
            experts: selected.map(e => e.name),
            exploitation: topExperts.map(e => e.name),
            exploration: unexplored.map(e => e.name),
            stats: {
                totalAvailable: activeExperts.length,
                selected: selected.length,
                exploitationCount: topExperts.length,
                explorationCount: unexplored.length
            }
        };
    }

    // Генерация отчета системы
    generateDualRatingReport() {
        const sourceStats = {
            total: this.sourceRatings.size,
            proven: Array.from(this.sourceRatings.values()).filter(s => s.status === 'proven').length,
            candidates: Array.from(this.sourceRatings.values()).filter(s => s.status === 'candidate').length,
            rejected: Array.from(this.sourceRatings.values()).filter(s => s.status === 'rejected').length,
            topSources: this.getTopSources(5)
        };

        const expertStats = {
            total: this.expertRatings.size,
            proven: Array.from(this.expertRatings.values()).filter(e => e.status === 'proven').length,
            candidates: Array.from(this.expertRatings.values()).filter(e => e.status === 'candidate').length,
            rejected: Array.from(this.expertRatings.values()).filter(e => e.status === 'rejected').length,
            topExperts: this.getTopExperts(5)
        };

        return {
            timestamp: new Date().toISOString(),
            sources: sourceStats,
            experts: expertStats,
            system: {
                explorationRate: 0.3,
                exploitationRate: 0.7,
                targetUserId: this.userId,
                activeMessages: this.messageHistory.size
            }
        };
    }

    // Экспорт данных для сохранения
    exportData() {
        return {
            sourceRatings: Object.fromEntries(this.sourceRatings),
            expertRatings: Object.fromEntries(this.expertRatings),
            messageHistory: Object.fromEntries(this.messageHistory),
            config: {
                userId: this.userId,
                reactionScores: this.reactionScores
            },
            timestamp: Date.now()
        };
    }

    // Импорт данных
    importData(data) {
        if (data.sourceRatings) {
            this.sourceRatings = new Map(Object.entries(data.sourceRatings));
        }
        if (data.expertRatings) {
            this.expertRatings = new Map(Object.entries(data.expertRatings));
        }
        if (data.messageHistory) {
            this.messageHistory = new Map(Object.entries(data.messageHistory));
        }
        if (data.config) {
            this.userId = data.config.userId || this.userId;
            this.reactionScores = data.config.reactionScores || this.reactionScores;
        }
    }

    // Очистка старых сообщений (старше 30 дней)
    cleanupOldMessages() {
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        let cleanedCount = 0;

        for (const [messageId, messageInfo] of this.messageHistory) {
            if (messageInfo.timestamp < thirtyDaysAgo) {
                this.messageHistory.delete(messageId);
                cleanedCount++;
            }
        }

        console.log(`🧹 Очищено ${cleanedCount} старых сообщений`);
        return cleanedCount;
    }
}

module.exports = DualRatingManager;

// Тестирование системы
if (require.main === module) {
    console.log('🧪 Тестирование Dual Rating системы...');
    
    const dualRating = new DualRatingManager();
    
    // Добавляем источники
    dualRating.addSource('OpenAI Blog', 'openai.com/blog', 'AI');
    dualRating.addSource('Anthropic', 'anthropic.com/news', 'AI');
    dualRating.addSource('TechCrunch', 'techcrunch.com', 'Tech');
    dualRating.addSource('Habr.com', 'habr.com', 'Tech');
    
    // Добавляем экспертов
    dualRating.addExpert('Андрей Карпатый', '@karpathy', 'AI');
    dualRating.addExpert('Сэм Альтман', '@sama', 'AI');
    dualRating.addExpert('Илон Маск', '@elonmusk', 'Tech');
    dualRating.addExpert('Редакция Habr', '@habr', 'Tech');
    
    // Симулируем сообщения и реакции
    dualRating.registerMessage('msg1', 'chat1', 
        { name: 'OpenAI Blog', url: 'openai.com/blog' },
        { name: 'Андрей Карпатый', handle: '@karpathy' }
    );
    
    dualRating.registerMessage('msg2', 'chat1',
        { name: 'TechCrunch', url: 'techcrunch.com' },
        { name: 'Илон Маск', handle: '@elonmusk' }
    );
    
    // Реакции на источники
    dualRating.processReaction('msg1', '🔥', 685668909, 'source');
    dualRating.processReaction('msg2', '👎', 685668909, 'source');
    
    // Реакции на экспертов
    dualRating.processReaction('msg1', '👍', 685668909, 'expert');
    dualRating.processReaction('msg2', '💩', 685668909, 'expert');
    
    // Еще реакции для статистики
    dualRating.processReaction('msg1', '🔥', 685668909, 'source');
    dualRating.processReaction('msg1', '👍', 685668909, 'expert');
    
    console.log('\n📊 Отчет системы:');
    const report = dualRating.generateDualRatingReport();
    console.log(JSON.stringify(report, null, 2));
    
    console.log('\n🎯 Тест Multi-Armed Bandit:');
    const sourceSelection = dualRating.selectSourcesWithBandit(['OpenAI Blog', 'TechCrunch', 'Anthropic', 'Habr.com'], 6);
    console.log('Выбранные источники:', sourceSelection);
    
    const expertSelection = dualRating.selectExpertsWithBandit(['Андрей Карпатый', 'Илон Маск', 'Сэм Альтман'], 3);
    console.log('Выбранные эксперты:', expertSelection);
    
    console.log('\n✅ Тестирование завершено!');
}