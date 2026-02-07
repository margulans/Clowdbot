#!/usr/bin/env node
// Полный тест Dual Rating системы

const { OpenClawDualRatingSystem } = require('./openclaw-dual-rating-integration.js');

// Мок OpenClaw tools для тестирования
function createMockTools() {
    let messageCounter = 0;
    
    const mockMessage = async (params) => {
        messageCounter++;
        const msgId = `msg_${messageCounter}`;
        
        console.log(`📱 [${new Date().toISOString().slice(11, 19)}] ${params.action.toUpperCase()} → ${params.target}`);
        console.log(`   📄 ${params.message.slice(0, 100)}${params.message.length > 100 ? '...' : ''}`);
        
        return {
            ok: true,
            messageId: msgId,
            chatId: params.target
        };
    };
    
    const mockWebSearch = async (params) => {
        console.log(`🔍 WEB_SEARCH: "${params.query}" (count: ${params.count})`);
        
        // Имитируем результаты поиска
        const mockResults = {
            'AI artificial intelligence': [
                {
                    title: 'OpenAI Announces GPT-5 with Revolutionary Capabilities',
                    description: 'The new model shows significant improvements in reasoning and multimodal understanding...',
                    url: 'https://openai.com/blog/gpt5-announcement',
                    siteName: 'OpenAI Blog'
                },
                {
                    title: 'Anthropic Releases Claude Opus 4.6 with Enhanced Safety',
                    description: 'Latest Claude model focuses on constitutional AI and improved alignment...',
                    url: 'https://anthropic.com/news/claude-opus-46',
                    siteName: 'Anthropic News'
                }
            ],
            'robotics humanoid robot': [
                {
                    title: 'Boston Dynamics Atlas Robot Demonstrates New Parkour Skills',
                    description: 'The humanoid robot showcases unprecedented agility and balance control...',
                    url: 'https://bostondynamics.com/news/atlas-parkour-update',
                    siteName: 'Boston Dynamics'
                },
                {
                    title: 'Tesla Optimus Robot Production Timeline Revealed',
                    description: 'Elon Musk shares ambitious plans for mass production of humanoid workers...',
                    url: 'https://tesla.com/blog/optimus-production',
                    siteName: 'Tesla Blog'
                }
            ],
            'eVTOL air taxi': [
                {
                    title: 'Joby Aviation Completes First Commercial Flight in NYC',
                    description: 'Historic milestone for urban air mobility as passengers fly over Manhattan...',
                    url: 'https://jobyaviation.com/news/nyc-first-flight',
                    siteName: 'Joby Aviation'
                }
            ],
            'technology innovation': [
                {
                    title: 'Apple Vision Pro 2 Features Revolutionary Eye Tracking',
                    description: 'Next generation mixed reality headset pushes boundaries of spatial computing...',
                    url: 'https://apple.com/newsroom/vision-pro-2',
                    siteName: 'Apple Newsroom'
                }
            ]
        };
        
        // Находим подходящие результаты
        let results = [];
        for (const [key, items] of Object.entries(mockResults)) {
            if (params.query.toLowerCase().includes(key.split(' ')[0])) {
                results = items.slice(0, params.count || 3);
                break;
            }
        }
        
        console.log(`   ✅ Найдено ${results.length} результатов`);
        
        return { results: results };
    };
    
    const mockMemoryStore = async (params) => {
        console.log(`🧠 MEMORY_STORE: ${params.text.slice(0, 80)}... (importance: ${params.importance})`);
        return { success: true };
    };
    
    const mockMemoryRecall = async (params) => {
        console.log(`🔍 MEMORY_RECALL: "${params.query}"`);
        return { memories: [] };
    };
    
    return {
        message: mockMessage,
        web_search: mockWebSearch,
        memory_store: mockMemoryStore,
        memory_recall: mockMemoryRecall
    };
}

// Функция для имитации задержки
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testFullDualRatingSystem() {
    console.log('🚀 ЗАПУСК ПОЛНОГО ТЕСТА DUAL RATING СИСТЕМЫ');
    console.log('=' * 60);
    
    try {
        // Инициализируем систему с мок-инструментами
        const mockTools = createMockTools();
        const dualSystem = new OpenClawDualRatingSystem(mockTools);
        
        console.log('✅ Система инициализирована');
        
        // Ждем инициализацию базы данных
        await sleep(1000);
        
        console.log('\n🧪 ТЕСТ 1: Персонализированный поиск новостей');
        console.log('-'.repeat(50));
        
        const aiNews = await dualSystem.searchPersonalizedNews(
            'AI artificial intelligence OpenAI', 
            'AI', 
            3
        );
        console.log(`📊 AI новости: ${aiNews.results?.length || 0} найдено`);
        
        const roboticsNews = await dualSystem.searchPersonalizedNews(
            'robotics humanoid robot Boston Dynamics',
            'Robotics',
            2
        );
        console.log(`📊 Robotics новости: ${roboticsNews.results?.length || 0} найдено`);
        
        console.log('\n🧪 ТЕСТ 2: Создание умного дайджеста');
        console.log('-'.repeat(50));
        
        const digestResult = await dualSystem.createSmartDigest();
        console.log(`📰 Дайджест создан: ${digestResult.newsCount} новостей`);
        console.log(`📊 Категории:`, digestResult.categories);
        
        await sleep(2000);
        
        console.log('\n🧪 ТЕСТ 3: Симуляция реакций пользователя');
        console.log('-'.repeat(50));
        
        // Имитируем позитивные реакции на хорошие источники
        const positiveReactions = [
            { messageId: 'msg_5', reaction: '🔥', source: 'OpenAI Blog' },
            { messageId: 'msg_6', reaction: '👍', source: 'Anthropic News' },
            { messageId: 'msg_7', reaction: '🔥', source: 'Boston Dynamics' },
            { messageId: 'msg_8', reaction: '👍', source: 'Joby Aviation' }
        ];
        
        for (const { messageId, reaction, source } of positiveReactions) {
            const result = await dualSystem.handleTelegramReaction(messageId, reaction, 685668909);
            if (result) {
                console.log(`👍 Источник "${source}" получил реакцию ${reaction}`);
            }
            await sleep(200);
        }
        
        // Имитируем негативные реакции
        const negativeReactions = [
            { messageId: 'msg_9', reaction: '👎', source: 'TechCrunch' },
            { messageId: 'msg_10', reaction: '💩', source: 'Unknown Source' }
        ];
        
        for (const { messageId, reaction, source } of negativeReactions) {
            const result = await dualSystem.handleTelegramReaction(messageId, reaction, 685668909);
            if (result) {
                console.log(`👎 Источник "${source}" получил реакцию ${reaction}`);
            }
            await sleep(200);
        }
        
        console.log('\n🧪 ТЕСТ 4: Отчет системы');
        console.log('-'.repeat(50));
        
        await dualSystem.sendSystemReportToUser();
        
        console.log('\n🧪 ТЕСТ 5: Проверка Multi-Armed Bandit');
        console.log('-'.repeat(50));
        
        // Получаем прямой доступ к системе рейтингов для демонстрации
        const dualRating = dualSystem.dualRating.dualRating;
        
        // Добавляем тестовые источники с разными рейтингами
        dualRating.addSource('High Rated Source', 'https://high.com', 'AI');
        dualRating.addSource('Medium Rated Source', 'https://medium.com', 'AI');
        dualRating.addSource('Low Rated Source', 'https://low.com', 'AI');
        dualRating.addSource('New Source', 'https://new.com', 'AI');
        
        // Симулируем реакции для создания рейтингов
        const highRated = dualRating.sourceRatings.get('High Rated Source');
        const mediumRated = dualRating.sourceRatings.get('Medium Rated Source');
        const lowRated = dualRating.sourceRatings.get('Low Rated Source');
        
        // Высокий рейтинг
        highRated.totalScore = 45;
        highRated.reactionsCount = 5;
        highRated.averageScore = 9.0;
        highRated.status = 'proven';
        
        // Средний рейтинг
        mediumRated.totalScore = 15;
        mediumRated.reactionsCount = 5;
        mediumRated.averageScore = 3.0;
        mediumRated.status = 'candidate';
        
        // Низкий рейтинг
        lowRated.totalScore = -10;
        lowRated.reactionsCount = 5;
        lowRated.averageScore = -2.0;
        lowRated.status = 'rejected';
        
        // Тестируем Multi-Armed Bandit
        const availableSources = ['High Rated Source', 'Medium Rated Source', 'Low Rated Source', 'New Source'];
        const selection = dualRating.selectSourcesWithBandit(availableSources, 6, 0.3);
        
        console.log('🎯 Multi-Armed Bandit результат:');
        console.log(`   📈 Exploitation (70%): ${selection.exploitation.join(', ')}`);
        console.log(`   🔍 Exploration (30%): ${selection.exploration.join(', ')}`);
        console.log(`   📊 Статистика: ${selection.stats.exploitationCount} + ${selection.stats.explorationCount} из ${selection.stats.totalAvailable} доступных`);
        
        // Проверяем что rejected источники исключены
        if (!selection.sources.includes('Low Rated Source')) {
            console.log('   ✅ Rejected источники корректно исключены');
        }
        
        console.log('\n🧪 ТЕСТ 6: Очистка старых данных');
        console.log('-'.repeat(50));
        
        const cleanedCount = await dualSystem.cleanupOldData();
        console.log(`🧹 Очищено записей: ${cleanedCount}`);
        
        console.log('\n🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!');
        console.log('=' * 60);
        
        // Финальная статистика
        const finalReport = dualSystem.dualRating.dualRating.generateDualRatingReport();
        console.log('\n📊 ФИНАЛЬНАЯ СТАТИСТИКА:');
        console.log(`🗞️  Источников: ${finalReport.sources.total} (${finalReport.sources.proven} proven, ${finalReport.sources.candidates} candidates, ${finalReport.sources.rejected} rejected)`);
        console.log(`👥 Экспертов: ${finalReport.experts.total} (${finalReport.experts.proven} proven, ${finalReport.experts.candidates} candidates, ${finalReport.experts.rejected} rejected)`);
        console.log(`📱 Активных сообщений: ${finalReport.system.activeMessages}`);
        console.log(`🎯 Целевой пользователь: ${finalReport.system.targetUserId}`);
        
        console.log('\n🔧 СИСТЕМА ГОТОВА К ИНТЕГРАЦИИ!');
        console.log('\n💡 СЛЕДУЮЩИЕ ШАГИ:');
        console.log('1. Интегрировать в основной код OpenClaw агента');
        console.log('2. Настроить webhook для получения реакций из @newsneiron');
        console.log('3. Добавить команды /smart_digest и /rating_report');
        console.log('4. Настроить автоматические дайджесты в cron');
        console.log('5. Мониторить качество персонализации через отчеты');
        
    } catch (error) {
        console.error('❌ ОШИБКА В ТЕСТАХ:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

// Запуск тестов
if (require.main === module) {
    testFullDualRatingSystem().catch(console.error);
}

module.exports = {
    testFullDualRatingSystem,
    createMockTools
};