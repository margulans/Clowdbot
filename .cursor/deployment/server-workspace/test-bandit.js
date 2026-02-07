#!/usr/bin/env node
// Тест Multi-Armed Bandit алгоритма

const NewsSourceManager = require('./news-source-manager.js');

async function runBanditTest() {
    console.log('🤖 Тестирование Multi-Armed Bandit алгоритма');
    console.log('=' * 50);
    
    const manager = new NewsSourceManager();
    
    // Инициализация
    console.log('\n📚 Инициализация системы...');
    await manager.initialize();
    
    // Симуляция реакций пользователя за несколько дней
    console.log('\n👤 Симуляция реакций пользователя...');
    
    const reactions = [
        // День 1 - пользователь любит качественные AI источники
        ['OpenAI Blog', '🔥'], ['Anthropic', '🔥'], ['Habr.com', '👍'],
        ['TechCrunch AI', '👎'], ['ScienceDaily AI', '👍'],
        
        // День 2 - больше реакций
        ['OpenAI Blog', '🔥'], ['Habr.com', '🔥'], ['Boston Dynamics', '👍'],
        ['GitHub Blog', '👍'], ['AeroTime', '👍'], ['TechCrunch AI', '💩'],
        
        // День 3 - закрепление предпочтений
        ['Anthropic', '🔥'], ['Cursor Blog', '🔥'], ['OpenAI Blog', '👍'],
        ['Habr.com', '👍'], ['Vertical Mag', '👍'], ['VC News Daily', '👎']
    ];
    
    for (const [source, reaction] of reactions) {
        await manager.handleUserReaction(source, reaction);
        console.log(`  ${reaction} ${source}`);
    }
    
    // Статистика после реакций
    console.log('\n📊 Статистика источников после обучения:');
    const stats = manager.getSourceStats();
    
    console.log(`Всего источников: ${stats.total}`);
    console.log(`Проверенные: ${stats.byStatus.proven}`);
    console.log(`Кандидаты: ${stats.byStatus.candidate}`);
    console.log(`Отклоненные: ${stats.byStatus.rejected}`);
    
    console.log('\n🏆 Топ источники:');
    stats.topSources.forEach((source, i) => {
        const emoji = source.status === 'proven' ? '🔥' : source.status === 'rejected' ? '💩' : '🤔';
        console.log(`  ${i+1}. ${emoji} ${source.name} (${source.avgScore.toFixed(1)} баллов, ${source.timesShown} показов)`);
    });
    
    // Тест выбора источников для дайджеста
    console.log('\n🎯 Тест выбора источников для дайджеста:');
    
    const availableSources = [
        'OpenAI Blog', 'Anthropic', 'Habr.com', 'TechCrunch AI', 
        'ScienceDaily AI', 'Boston Dynamics', 'GitHub Blog', 'AeroTime',
        'Cursor Blog', 'Vertical Mag', 'VC News Daily', 'IEEE Spectrum Robotics'
    ];
    
    const selection = await manager.selectSourcesForDigest(availableSources, 8);
    
    console.log(`\n📰 Выбрано для дайджеста (${selection.sources.length} источников):`);
    console.log(`🎯 Эксплуатация (${selection.exploitation.length}): ${selection.exploitation.join(', ')}`);
    console.log(`🔍 Исследование (${selection.exploration.length}): ${selection.exploration.join(', ')}`);
    
    console.log('\n📈 Статистика выбора:');
    console.log(`- Всего доступных: ${selection.stats.totalSources}`);
    console.log(`- Отклонено: ${selection.stats.rejectedSources}`);
    console.log(`- Исследование/Эксплуатация: ${selection.stats.explorationCount}/${selection.stats.exploitationCount}`);
    
    // Рекомендации по оптимизации
    console.log('\n💡 Рекомендации по оптимизации:');
    const recommendations = manager.getOptimizationRecommendations();
    
    console.log(`Здоровье системы: ${recommendations.health.score}/100 (${recommendations.health.status})`);
    
    recommendations.recommendations.forEach((rec, i) => {
        console.log(`  ${i+1}. ${rec.message} (${rec.action})`);
    });
    
    // Демонстрация принципа "свинья у корыта"
    console.log('\n🐷 Принцип "свинья у корыта" в действии:');
    console.log('После положительных реакций на OpenAI Blog и Habr.com,');
    console.log('алгоритм будет чаще выбирать эти источники для дайджестов.');
    console.log('TechCrunch AI получил 💩, поэтому будет реже показываться.');
    
    console.log('\n✅ Тест Multi-Armed Bandit алгоритма завершен!');
    console.log('\n📚 Файлы созданы:');
    console.log('  - multi-armed-bandit.js (основной алгоритм)');
    console.log('  - news-source-manager.js (интеграция)');
    console.log('  - data/source-bandit-state.json (состояние)');
}

// Запуск теста
if (require.main === module) {
    runBanditTest().catch(console.error);
}

module.exports = { runBanditTest };