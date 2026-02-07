# Система анализа обратной связи

## Анализ реакций пользователя

### Еженедельный анализ
Каждое воскресенье система анализирует реакции Маргулана за неделю:

```python
def analyze_weekly_feedback():
    """Анализирует реакции за неделю и обновляет веса"""
    
    # Подсчет реакций по категориям
    category_scores = {}
    for reaction in weekly_reactions:
        category = reaction['category']
        score = reaction['score']
        
        if category not in category_scores:
            category_scores[category] = {'total_score': 0, 'count': 0}
            
        category_scores[category]['total_score'] += score
        category_scores[category]['count'] += 1
    
    # Обновление весов категорий
    for category, data in category_scores.items():
        avg_score = data['total_score'] / data['count']
        
        # Адаптация весов на основе средней оценки
        if avg_score > 1.5:  # Очень положительно
            category_weights[category] *= 1.1
        elif avg_score > 0.5:  # Положительно 
            category_weights[category] *= 1.05
        elif avg_score < -1.0:  # Очень негативно
            category_weights[category] *= 0.9
        elif avg_score < 0:  # Негативно
            category_weights[category] *= 0.95
    
    # Анализ источников
    source_performance = analyze_sources(weekly_reactions)
    update_source_bonuses(source_performance)
    
    # Анализ ключевых слов
    keyword_analysis = analyze_keywords(weekly_reactions)
    update_keyword_weights(keyword_analysis)

def analyze_sources(reactions):
    """Анализ производительности источников"""
    source_scores = {}
    
    for reaction in reactions:
        source = reaction['source']
        score = reaction['score']
        
        if source not in source_scores:
            source_scores[source] = []
        source_scores[source].append(score)
    
    # Вычисление средних оценок
    source_performance = {}
    for source, scores in source_scores.items():
        avg_score = sum(scores) / len(scores)
        source_performance[source] = {
            'avg_score': avg_score,
            'total_reactions': len(scores),
            'positive_ratio': len([s for s in scores if s > 0]) / len(scores)
        }
    
    return source_performance
```

### Система оповещений
```python
def generate_feedback_report():
    """Создает еженедельный отчет для Маргулана"""
    
    report = f"""
    📊 **Еженедельный анализ предпочтений**
    
    **Топ-категории (по реакциям):**
    1. {top_category} - {avg_score:.1f} балла
    2. {second_category} - {avg_score:.1f} балла
    
    **Лучшие источники:**
    1. {top_source} - {avg_score:.1f} балла
    2. {second_source} - {avg_score:.1f} балла
    
    **Изменения в алгоритме:**
    - Повышен приоритет: {improved_categories}
    - Понижен приоритет: {decreased_categories}
    
    **Рекомендации:**
    - Добавить больше контента по теме: {suggested_topics}
    - Рассмотреть исключение источника: {poor_sources}
    """
    
    return report
```

## Метрики качества

### KPI системы:
- **Средняя оценка новостей**: цель > 1.5 балла
- **Процент положительных реакций**: цель > 70%
- **Снижение негативных**: цель < 10%
- **Улучшение со временем**: рост средней оценки на 10% в месяц

### Визуализация прогресса:
```
Неделя 1: 👍👍👎😐❤️ (средняя: 0.8)
Неделя 2: 👍❤️👍😐👌 (средняя: 1.4)  
Неделя 3: ❤️👍👍👌❤️ (средняя: 1.8)
Неделя 4: 👍❤️❤️👍👌 (средняя: 2.0)

Прогресс: ↗️ +150% за месяц
```

## A/B тестирование
Система может тестировать:
- **Разные форматы** подачи новостей
- **Различную длину** контента  
- **Альтернативные источники** для одной темы
- **Разное время** публикации дайджестов

## Долгосрочное обучение
```python
# Пример накопленных предпочтений через 3 месяца
learned_preferences = {
    "categories": {
        "AI": {"weight": 2.8, "confidence": 0.95},
        "eVTOL": {"weight": 2.1, "confidence": 0.87},
        "robotics": {"weight": 1.9, "confidence": 0.92}
    },
    "content_style": {
        "optimal_length": "150-300 words",
        "prefers_technical": True,
        "likes_data_points": True,
        "dislikes_speculation": True
    },
    "timing": {
        "best_reaction_time": "morning_digest",
        "weekend_preference": "deeper_analysis"
    }
}
```