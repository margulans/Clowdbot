#!/usr/bin/env node
/**
 * Weekly Exploration Analysis Script
 * Анализирует источники и применяет правило 33% exploration
 */

const fs = require('fs');

// Загружаем данные
function loadSourceData() {
    const sourceStatus = JSON.parse(fs.readFileSync('source-status-tracking.json', 'utf8'));
    const userFeedback = JSON.parse(fs.readFileSync('user-feedback-data.json', 'utf8'));
    
    return { sourceStatus, userFeedback };
}

// Анализ производительности источников
function analyzeSourcePerformance(sources, reactions) {
    const performance = {};
    
    // Обрабатываем реакции по источникам
    reactions.forEach(reaction => {
        const source = reaction.source;
        if (!performance[source]) {
            performance[source] = {
                reactions: [],
                total_score: 0,
                positive_count: 0,
                negative_count: 0
            };
        }
        
        performance[source].reactions.push(reaction.score);
        performance[source].total_score += reaction.score;
        
        if (reaction.score > 0) performance[source].positive_count++;
        if (reaction.score < 0) performance[source].negative_count++;
    });
    
    // Вычисляем статистики
    Object.keys(performance).forEach(source => {
        const data = performance[source];
        data.avg_rating = data.total_score / data.reactions.length;
        data.total_reactions = data.reactions.length;
        data.positive_ratio = data.positive_count / data.total_reactions;
        
        // Определяем статус источника
        if (data.total_reactions >= 10 && data.avg_rating > 1.5) {
            data.status = 'proven';
        } else if (data.total_reactions >= 5) {
            data.status = 'candidate';
        } else {
            data.status = 'new';
        }
    });
    
    return performance;
}

// Обновление статусов источников
function updateSourceStatuses(performance) {
    const categories = {
        proven: [],
        exploration: [],
        rejected: []
    };
    
    Object.keys(performance).forEach(source => {
        const data = performance[source];
        
        if (data.status === 'proven') {
            categories.proven.push({
                source,
                rating: data.avg_rating,
                reactions: data.total_reactions,
                bonus: data.avg_rating > 2.0 ? 20 : 15
            });
        } else if (data.avg_rating < -0.5 && data.total_reactions > 5) {
            categories.rejected.push({
                source,
                rating: data.avg_rating,
                reason: 'low_rating'
            });
        } else {
            categories.exploration.push({
                source,
                rating: data.avg_rating || 0,
                reactions: data.total_reactions || 0,
                priority: data.total_reactions < 2 ? 10 : 8
            });
        }
    });
    
    return categories;
}

// Генерация еженедельного отчета
function generateWeeklyReport(categories, stats) {
    const report = `# 📊 Еженедельный отчет источников

## Статистика
- **Проверенных источников**: ${categories.proven.length} (${Math.round(categories.proven.length / (categories.proven.length + categories.exploration.length) * 100)}%)
- **Исследуемых источников**: ${categories.exploration.length}
- **Отклоненных источников**: ${categories.rejected.length}

## 🏆 Топ-5 проверенных источников
${categories.proven
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 5)
    .map((s, i) => `${i + 1}. ${s.source} - рейтинг ${s.rating.toFixed(1)} (${s.reactions} оценок)`)
    .join('\n')}

## 🔍 Новые источники на исследовании
${categories.exploration
    .filter(s => s.reactions < 5)
    .map(s => `- ${s.source} - ${s.reactions} оценок`)
    .join('\n')}

## ⚠️ Отклоненные источники
${categories.rejected.map(s => `- ${s.source} - рейтинг ${s.rating.toFixed(1)}`).join('\n')}

## 🎯 Рекомендации на следующую неделю
- Добавить ${3 - categories.exploration.filter(s => s.reactions < 2).length} новых источника
- Протестировать ${categories.exploration.filter(s => s.reactions >= 5 && s.reactions < 10).length} кандидатов
- Исключить из ротации ${categories.rejected.length > 0 ? categories.rejected.map(s => s.source).join(', ') : 'нет источников'}

## 📈 Правило 33% exploration
- **Цель**: 3 новости из новых источников в каждом дайджесте
- **Текущий пул exploration**: ${categories.exploration.length} источников
- **Статус**: ${categories.exploration.length >= 5 ? '✅ Достаточно' : '⚠️ Нужно больше источников'}

---
_Анализ от ${new Date().toLocaleDateString('ru-RU')}_`;

    return report;
}

// Основная функция
function runWeeklyAnalysis() {
    console.log('🔍 Запуск еженедельного анализа источников...');
    
    try {
        const { sourceStatus, userFeedback } = loadSourceData();
        
        // Анализируем производительность
        const performance = analyzeSourcePerformance(
            sourceStatus.sources, 
            userFeedback.reactions_log || []
        );
        
        // Обновляем категории
        const categories = updateSourceStatuses(performance);
        
        // Генерируем отчет
        const report = generateWeeklyReport(categories, sourceStatus.exploration_stats);
        
        // Сохраняем отчет
        const reportFile = `weekly-analysis-${new Date().toISOString().slice(0, 10)}.md`;
        fs.writeFileSync(reportFile, report);
        
        // Обновляем статусы в tracking файле
        sourceStatus.exploration_stats.last_analysis = new Date().toISOString();
        sourceStatus.exploration_stats.total_sources = Object.keys(performance).length;
        sourceStatus.exploration_stats.proven_sources = categories.proven.length;
        sourceStatus.exploration_stats.exploration_sources = categories.exploration.length;
        sourceStatus.exploration_stats.rejected_sources = categories.rejected.length;
        
        fs.writeFileSync('source-status-tracking.json', JSON.stringify(sourceStatus, null, 2));
        
        console.log(`✅ Анализ завершен! Отчет сохранен: ${reportFile}`);
        console.log(`📊 Проверенных: ${categories.proven.length}, Исследуемых: ${categories.exploration.length}, Отклонено: ${categories.rejected.length}`);
        
    } catch (error) {
        console.error('❌ Ошибка анализа:', error.message);
    }
}

// Запуск, если файл выполняется напрямую
if (require.main === module) {
    runWeeklyAnalysis();
}

module.exports = { runWeeklyAnalysis, analyzeSourcePerformance, updateSourceStatuses };