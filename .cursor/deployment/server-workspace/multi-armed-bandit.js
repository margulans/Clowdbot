// Multi-Armed Bandit Algorithm for News Source Selection
// Принцип "свинья у корыта" - больше лучшего контента

class NewsSourceBandit {
    constructor() {
        this.sources = new Map();
        this.explorationRate = 0.30;  // 30% исследование
        this.exploitationRate = 0.70; // 70% эксплуатация
        this.userId = 685668909; // Только реакции этого пользователя
        
        // Маппинг реакций Telegram на баллы
        this.reactionScores = {
            '🔥': 10,  // Огонь - отлично
            '👍': 5,   // Лайк - нравится
            '👎': -3,  // Дизлайк - не нравится
            '💩': -5   // Мусор - плохо
        };
    }

    // Добавить источник в систему
    addSource(name, url, category = 'general') {
        if (!this.sources.has(name)) {
            this.sources.set(name, {
                name: name,
                url: url,
                category: category,
                totalScore: 0,
                timesSelected: 0,
                timesShown: 0,
                reactions: [],
                confidence: 0.5, // Начальная уверенность
                lastUsed: null,
                status: 'candidate' // candidate, proven, rejected
            });
        }
    }

    // Обновить рейтинг источника на основе реакции
    updateSourceRating(sourceName, reaction, userId) {
        // Учитываем только реакции нужного пользователя
        if (userId !== this.userId) return;
        
        const source = this.sources.get(sourceName);
        if (!source) return;

        const score = this.reactionScores[reaction] || 0;
        
        source.reactions.push({
            reaction: reaction,
            score: score,
            timestamp: Date.now(),
            userId: userId
        });

        source.totalScore += score;
        source.timesShown += 1;
        
        // Обновить статус источника
        this.updateSourceStatus(sourceName);
        
        console.log(`Source ${sourceName}: reaction ${reaction} (${score}), new total: ${source.totalScore}`);
    }

    // Обновить статус источника
    updateSourceStatus(sourceName) {
        const source = this.sources.get(sourceName);
        if (!source || source.timesShown < 3) return; // Минимум 3 показа

        const avgScore = source.totalScore / source.timesShown;
        
        if (avgScore >= 7) {
            source.status = 'proven';
        } else if (avgScore <= -2) {
            source.status = 'rejected';
        } else {
            source.status = 'candidate';
        }
    }

    // Upper Confidence Bound для выбора источников
    calculateUCB(source, totalSelections) {
        if (source.timesShown === 0) return Infinity;
        
        const avgReward = source.totalScore / source.timesShown;
        const confidence = Math.sqrt(
            (2 * Math.log(totalSelections)) / source.timesShown
        );
        
        return avgReward + confidence;
    }

    // Выбрать источники для дайджеста
    selectSourcesForDigest(availableSources, targetCount = 10) {
        const activeSource = Array.from(this.sources.values())
            .filter(s => s.status !== 'rejected')
            .filter(s => availableSources.includes(s.name));

        const totalSelections = activeSource.reduce((sum, s) => sum + s.timesShown, 0) || 1;
        
        // Разделить на исследование и эксплуатацию
        const explorationCount = Math.floor(targetCount * this.explorationRate);
        const exploitationCount = targetCount - explorationCount;

        let selected = [];

        // ЭКСПЛУАТАЦИЯ (70%): лучшие источники
        const sortedByUCB = activeSource
            .map(source => ({
                ...source,
                ucbScore: this.calculateUCB(source, totalSelections)
            }))
            .sort((a, b) => b.ucbScore - a.ucbScore);

        // Берем топ источники для эксплуатации
        const exploitation = sortedByUCB.slice(0, exploitationCount);
        selected.push(...exploitation);

        // ИССЛЕДОВАНИЕ (30%): новые или мало показанные источники
        const unexplored = activeSource
            .filter(s => !selected.some(sel => sel.name === s.name))
            .sort((a, b) => a.timesShown - b.timesShown);

        const exploration = unexplored.slice(0, explorationCount);
        selected.push(...exploration);

        // Обновить счетчики выбора
        selected.forEach(source => {
            const originalSource = this.sources.get(source.name);
            if (originalSource) {
                originalSource.timesSelected += 1;
                originalSource.lastUsed = Date.now();
            }
        });

        return {
            sources: selected.map(s => s.name),
            exploitation: exploitation.map(s => s.name),
            exploration: exploration.map(s => s.name),
            stats: {
                totalSources: activeSource.length,
                exploitationCount: exploitation.length,
                explorationCount: exploration.length,
                rejectedSources: this.sources.size - activeSource.length
            }
        };
    }

    // Получить статистику источников
    getSourceStats() {
        const sources = Array.from(this.sources.values());
        
        const byStatus = {
            proven: sources.filter(s => s.status === 'proven'),
            candidate: sources.filter(s => s.status === 'candidate'),
            rejected: sources.filter(s => s.status === 'rejected')
        };

        const topSources = sources
            .filter(s => s.timesShown > 0)
            .map(s => ({
                name: s.name,
                avgScore: s.totalScore / s.timesShown,
                timesShown: s.timesShown,
                status: s.status
            }))
            .sort((a, b) => b.avgScore - a.avgScore);

        return {
            total: sources.length,
            byStatus: {
                proven: byStatus.proven.length,
                candidate: byStatus.candidate.length,
                rejected: byStatus.rejected.length
            },
            topSources: topSources.slice(0, 10),
            explorationRate: this.explorationRate
        };
    }

    // Экспорт данных для сохранения
    exportData() {
        return {
            sources: Object.fromEntries(this.sources),
            config: {
                explorationRate: this.explorationRate,
                exploitationRate: this.exploitationRate,
                userId: this.userId,
                reactionScores: this.reactionScores
            },
            timestamp: Date.now()
        };
    }

    // Импорт данных
    importData(data) {
        if (data.sources) {
            this.sources = new Map(Object.entries(data.sources));
        }
        if (data.config) {
            this.explorationRate = data.config.explorationRate || 0.30;
            this.exploitationRate = data.config.exploitationRate || 0.70;
        }
    }
}

// Экспорт для использования в Node.js
module.exports = NewsSourceBandit;

// Пример использования:
if (require.main === module) {
    const bandit = new NewsSourceBandit();
    
    // Добавить источники
    bandit.addSource('TechCrunch', 'techcrunch.com', 'AI/Tech');
    bandit.addSource('OpenAI Blog', 'openai.com/blog', 'AI');
    bandit.addSource('Anthropic', 'anthropic.com/news', 'AI');
    bandit.addSource('Habr.com', 'habr.com', 'AI/Tech');
    
    // Симуляция реакций пользователя
    bandit.updateSourceRating('OpenAI Blog', '🔥', 685668909);
    bandit.updateSourceRating('Habr.com', '👍', 685668909);
    bandit.updateSourceRating('TechCrunch', '👎', 685668909);
    
    // Выбрать источники для дайджеста
    const selection = bandit.selectSourcesForDigest(['TechCrunch', 'OpenAI Blog', 'Anthropic', 'Habr.com'], 6);
    console.log('Selected sources:', selection);
    
    // Статистика
    console.log('Source stats:', bandit.getSourceStats());
}