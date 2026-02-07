// News Source Manager - интеграция Multi-Armed Bandit с системой новостей
const fs = require('fs').promises;
const path = require('path');
const NewsSourceBandit = require('./multi-armed-bandit.js');

class NewsSourceManager {
    constructor() {
        this.bandit = new NewsSourceBandit();
        this.dataFile = path.join(__dirname, 'data', 'source-bandit-state.json');
        this.initialized = false;
    }

    // Инициализация системы
    async initialize() {
        try {
            // Загружаем сохраненное состояние
            await this.loadState();
            
            // Добавляем известные источники если их нет
            await this.initializeKnownSources();
            
            this.initialized = true;
            console.log('📊 Multi-Armed Bandit система инициализирована');
        } catch (error) {
            console.error('Ошибка инициализации:', error);
        }
    }

    // Загрузка состояния из файла
    async loadState() {
        try {
            const data = await fs.readFile(this.dataFile, 'utf8');
            const state = JSON.parse(data);
            this.bandit.importData(state);
            console.log('✅ Загружено состояние источников');
        } catch (error) {
            console.log('📝 Создается новое состояние источников');
        }
    }

    // Сохранение состояния в файл
    async saveState() {
        try {
            // Создаем папку data если не существует
            await fs.mkdir(path.dirname(this.dataFile), { recursive: true });
            
            const state = this.bandit.exportData();
            await fs.writeFile(this.dataFile, JSON.stringify(state, null, 2));
            console.log('💾 Состояние источников сохранено');
        } catch (error) {
            console.error('Ошибка сохранения:', error);
        }
    }

    // Инициализация известных источников
    async initializeKnownSources() {
        const knownSources = [
            // AI/ML источники  
            { name: 'OpenAI Blog', url: 'openai.com/blog', category: 'AI' },
            { name: 'Anthropic', url: 'anthropic.com/news', category: 'AI' },
            { name: 'Habr.com', url: 'habr.com', category: 'AI/Tech' },
            { name: 'ScienceDaily AI', url: 'sciencedaily.com/ai', category: 'AI' },
            { name: 'TechCrunch AI', url: 'techcrunch.com/category/artificial-intelligence', category: 'AI' },
            
            // Робототехника
            { name: 'Boston Dynamics', url: 'bostondynamics.com/blog', category: 'Robotics' },
            { name: 'IEEE Spectrum Robotics', url: 'spectrum.ieee.org/robotics', category: 'Robotics' },
            
            // eVTOL
            { name: 'AeroTime', url: 'aerotime.aero', category: 'eVTOL' },
            { name: 'Vertical Mag', url: 'verticalmag.com', category: 'eVTOL' },
            
            // Вайбкодинг
            { name: 'GitHub Blog', url: 'github.blog', category: 'Coding' },
            { name: 'Cursor Blog', url: 'cursor.com/blog', category: 'Coding' },
            
            // Бизнес
            { name: 'TechStartups', url: 'techstartups.com', category: 'Business' },
            { name: 'VC News Daily', url: 'vcnewsdaily.com', category: 'Funding' }
        ];

        for (const source of knownSources) {
            this.bandit.addSource(source.name, source.url, source.category);
        }

        console.log(`📚 Добавлено ${knownSources.length} известных источников`);
    }

    // Обработка реакции пользователя
    async handleUserReaction(sourceName, reaction, userId = 685668909) {
        if (!this.initialized) {
            await this.initialize();
        }

        this.bandit.updateSourceRating(sourceName, reaction, userId);
        await this.saveState();

        // Логирование для отладки
        const stats = this.getSourceStats();
        console.log(`👤 Реакция ${reaction} на ${sourceName}, статистика обновлена`);
        
        return stats;
    }

    // Выбор источников для дайджеста
    async selectSourcesForDigest(availableSources, count = 10) {
        if (!this.initialized) {
            await this.initialize();
        }

        const selection = this.bandit.selectSourcesForDigest(availableSources, count);
        await this.saveState(); // Сохраняем обновленные счетчики

        return selection;
    }

    // Получить статистику источников
    getSourceStats() {
        return this.bandit.getSourceStats();
    }

    // Получить рекомендации по оптимизации
    getOptimizationRecommendations() {
        const stats = this.getSourceStats();
        const recommendations = [];

        // Проверка баланса исследования/эксплуатации
        if (stats.byStatus.proven < 5) {
            recommendations.push({
                type: 'exploration',
                message: 'Нужно больше новых источников для тестирования',
                action: 'increase_exploration'
            });
        }

        // Слишком много отклоненных источников
        if (stats.byStatus.rejected > stats.total * 0.3) {
            recommendations.push({
                type: 'cleanup',
                message: 'Много отклоненных источников, нужна очистка',
                action: 'remove_rejected_sources'
            });
        }

        // Недостаточно данных для принятия решений
        if (stats.total < 20) {
            recommendations.push({
                type: 'growth',
                message: 'Добавить больше источников для анализа',
                action: 'discover_new_sources'
            });
        }

        return {
            stats: stats,
            recommendations: recommendations,
            health: this.calculateSystemHealth()
        };
    }

    // Рассчитать "здоровье" системы
    calculateSystemHealth() {
        const stats = this.getSourceStats();
        let score = 0;

        // Есть проверенные источники
        if (stats.byStatus.proven >= 5) score += 30;
        
        // Баланс между исследованием и эксплуатацией
        const ratio = stats.byStatus.candidate / (stats.total || 1);
        if (ratio >= 0.3 && ratio <= 0.7) score += 25;
        
        // Не слишком много отклоненных
        if (stats.byStatus.rejected < stats.total * 0.2) score += 25;
        
        // Достаточно источников
        if (stats.total >= 15) score += 20;

        return {
            score: score,
            status: score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'needs_improvement'
        };
    }
}

// Экспорт
module.exports = NewsSourceManager;

// Тестирование если запущен напрямую
if (require.main === module) {
    async function test() {
        const manager = new NewsSourceManager();
        
        console.log('🧪 Тестирование News Source Manager...');
        
        // Инициализация
        await manager.initialize();
        
        // Симуляция реакций
        await manager.handleUserReaction('Habr.com', '🔥');
        await manager.handleUserReaction('OpenAI Blog', '🔥');
        await manager.handleUserReaction('TechCrunch AI', '👍');
        await manager.handleUserReaction('ScienceDaily AI', '👎');
        
        // Выбор источников
        const sources = ['Habr.com', 'OpenAI Blog', 'TechCrunch AI', 'ScienceDaily AI', 'Anthropic'];
        const selection = await manager.selectSourcesForDigest(sources, 6);
        
        console.log('📊 Выбранные источники:', selection);
        
        // Рекомендации
        const recommendations = manager.getOptimizationRecommendations();
        console.log('💡 Рекомендации:', recommendations);
    }
    
    test().catch(console.error);
}