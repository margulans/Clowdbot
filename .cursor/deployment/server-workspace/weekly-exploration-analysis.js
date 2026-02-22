#!/usr/bin/env node
/**
 * Weekly Exploration Analysis Script (ESM)
 * Анализирует текущий пул источников и применяет правило 33% exploration.
 *
 * NOTE:
 * - Репозиторий использует package.json {"type":"module"}, поэтому этот скрипт написан как ESM.
 * - Источник правды по источникам: source-status-tracking.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_TRACKING_FILE = path.join(__dirname, 'source-status-tracking.json');
const USER_FEEDBACK_FILE = path.join(__dirname, 'user-feedback-data.json');

function safeReadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Загружаем данные
function loadSourceData() {
  const sourceStatus = safeReadJson(SOURCE_TRACKING_FILE);

  let userFeedback = null;
  try {
    userFeedback = safeReadJson(USER_FEEDBACK_FILE);
  } catch {
    // optional
  }

  return { sourceStatus, userFeedback };
}

/**
 * Нормализованный “performance” по каждому source.
 * В отличие от старой версии: НЕ полагаемся на user-feedback-data.json, потому что он может быть пустым.
 */
function analyzeSourcePerformance(sourceStatus, userFeedback) {
  const sources = sourceStatus?.sources || {};

  /**
   * performance[source] = {
   *  total_reactions, avg_rating, positive_ratio, status
   * }
   */
  const performance = {};

  for (const [sourceName, s] of Object.entries(sources)) {
    const total = Number(s.total_reactions || 0);
    const avg = Number(s.avg_rating || 0);

    // crude “positive_ratio” from reaction_history if available
    const hist = Array.isArray(s.reaction_history) ? s.reaction_history : [];
    const pos = hist.filter(r => (r?.value ?? 0) > 0).length;
    const neg = hist.filter(r => (r?.value ?? 0) < 0).length;
    const denom = hist.length || 1;

    performance[sourceName] = {
      total_reactions: total,
      avg_rating: avg,
      positive_ratio: pos / denom,
      positive_count: pos,
      negative_count: neg,
      status: 'new'
    };

    // Status thresholds (aligned with update-source-ratings.js)
    if (total > 10 && avg >= 1.5) {
      performance[sourceName].status = 'proven';
    } else if (total > 5) {
      performance[sourceName].status = 'candidate';
    } else if (avg < -1.0 && total > 3) {
      performance[sourceName].status = 'rejected';
    }
  }

  // Optionally merge reactions log (if present)
  const reactions = userFeedback?.reactions_log;
  if (Array.isArray(reactions) && reactions.length > 0) {
    for (const r of reactions) {
      const source = r?.source;
      const score = Number(r?.score ?? 0);
      if (!source) continue;

      if (!performance[source]) {
        performance[source] = {
          total_reactions: 0,
          avg_rating: 0,
          positive_ratio: 0,
          positive_count: 0,
          negative_count: 0,
          status: 'new'
        };
      }
      // Do NOT recompute avg here (source-status-tracking is the canonical place).
      // We only keep this merge so the report can mention “there are raw reactions”.
      if (score > 0) performance[source].positive_count++;
      if (score < 0) performance[source].negative_count++;
    }
  }

  return performance;
}

function updateSourceStatuses(performance) {
  const categories = {
    proven: [],
    exploration: [],
    rejected: []
  };

  for (const [source, data] of Object.entries(performance)) {
    const total = data.total_reactions || 0;
    const rating = data.avg_rating || 0;

    if (data.status === 'proven') {
      categories.proven.push({
        source,
        rating,
        reactions: total,
        priority_bonus: rating >= 2.0 ? 20 : 15
      });
      continue;
    }

    if (data.status === 'rejected') {
      categories.rejected.push({
        source,
        rating,
        reactions: total,
        priority_bonus: 0,
        reason: 'low_rating'
      });
      continue;
    }

    // exploration bucket = new + candidate
    categories.exploration.push({
      source,
      rating,
      reactions: total,
      status: data.status,
      // new sources get a bit more to ensure they appear and gather signal
      priority_bonus: total < 2 ? 10 : (data.status === 'candidate' ? 12 : 8)
    });
  }

  return categories;
}

function generateWeeklyReport(categories, sourceStatus) {
  const proven = categories.proven.length;
  const exploration = categories.exploration.length;
  const rejected = categories.rejected.length;
  const denom = Math.max(1, proven + exploration);
  const provenPct = Math.round((proven / denom) * 100);

  // Rule 33%: assume target_news from config; fallback 12
  const targetNews = Number(sourceStatus?.digest_config?.target_news ?? 12);
  const explorationTarget = Math.max(1, Math.round(targetNews * 0.33));

  const topProven = categories.proven
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 5)
    .map((s, i) => `${i + 1}. ${s.source} — рейтинг ${s.rating.toFixed(2)} (${s.reactions} оценок)`)
    .join('\n');

  const newOnExploration = categories.exploration
    .filter(s => s.reactions < 5)
    .sort((a, b) => (a.reactions - b.reactions) || (b.priority_bonus - a.priority_bonus))
    .slice(0, 12)
    .map(s => `- ${s.source} — ${s.reactions} оценок (статус: ${s.status}, bonus=${s.priority_bonus})`)
    .join('\n');

  const rejectedList = categories.rejected
    .sort((a, b) => a.rating - b.rating)
    .map(s => `- ${s.source} — рейтинг ${s.rating.toFixed(2)} (${s.reactions} оценок)`)
    .join('\n');

  const report = `# 📊 Еженедельный отчет источников (exploration)

## Сводка
- **Всего источников**: ${Object.keys(sourceStatus?.sources || {}).length}
- **Проверенных (proven)**: ${proven} (${provenPct}%)
- **Exploration (new + candidate)**: ${exploration}
- **Rejected**: ${rejected}

## 🏆 Топ проверенных
${topProven || '_Пока нет достаточного числа proven-источников (нужно накопить реакции)._'}

## 🔍 Exploration-пул (мало сигналов)
${newOnExploration || '_Нет источников в exploration-пуле._'}

## ⚠️ Rejected
${rejectedList || '_Нет отклонённых источников._'}

## 📈 Правило 33% exploration (по дайджесту)
- Цель: **~${explorationTarget} новости** из exploration-источников на дайджест (из ~${targetNews})
- Рекомендация: держать exploration-источники «в ротации», пока каждый не наберёт **5–10** реакций

## 🎯 Рекомендации на следующую неделю
- Добавить **3 новых источника** (AI/robotics/eVTOL/business) в exploration очередь
- Сконцентрировать ротацию на источниках с 0–2 реакциями (нужно быстрее набрать статистику)
- Цель: повысить число proven-источников хотя бы до **3–5**, иначе “33% exploration” не работает симметрично (нечем заполнять 67% proven)

---
_Анализ от ${new Date().toLocaleDateString('ru-RU')}_`;

  return report;
}

function ensureRecommendedSourcesQueued(sourceStatus) {
  // verified feeds:
  const recommended = [
    {
      name: 'https://www.marktechpost.com/feed/',
      type: 'rss_feed',
      category: 'AI',
      topics: ['AI', 'research'],
      discovery_method: 'weekly_exploration'
    },
    {
      name: 'http://www.therobotreport.com/feed/',
      type: 'rss_feed',
      category: 'robotics',
      topics: ['robotics', 'automation'],
      discovery_method: 'weekly_exploration'
    },
    {
      name: 'https://www.aviationtoday.com/feed/',
      type: 'rss_feed',
      category: 'eVTOL',
      topics: ['eVTOL', 'aviation'],
      discovery_method: 'weekly_exploration'
    }
  ];

  sourceStatus.exploration_queue = sourceStatus.exploration_queue || {
    high_priority: [],
    medium_priority: [],
    low_priority: [],
    scheduled_rediscovery: []
  };

  const hp = sourceStatus.exploration_queue.high_priority || [];
  const existing = new Set([
    ...Object.keys(sourceStatus.sources || {}),
    ...hp.map(x => x?.name).filter(Boolean)
  ]);

  for (const r of recommended) {
    if (existing.has(r.name)) continue;
    hp.push({
      name: r.name,
      type: r.type,
      discovery_method: r.discovery_method,
      relevance_score: 7.5,
      topics: r.topics,
      keyword_matches: [],
      discovered_date: new Date().toISOString(),
      status: 'queued'
    });

    // Also add into sources list as "auto_discovered" so it can be picked up by the pipeline.
    sourceStatus.sources = sourceStatus.sources || {};
    sourceStatus.sources[r.name] = {
      status: 'auto_discovered',
      category: r.category,
      total_reactions: 0,
      avg_rating: 0,
      first_added: new Date().toISOString().split('T')[0],
      priority_bonus: 10,
      exploration_status: 'new',
      discovery_method: r.discovery_method,
      discovery_date: new Date().toISOString(),
      topics: r.topics
    };
  }

  sourceStatus.exploration_queue.high_priority = hp;
  return sourceStatus;
}

function applyPriorityUpdates(sourceStatus, categories) {
  sourceStatus.sources = sourceStatus.sources || {};

  const bonusMap = new Map();
  const statusMap = new Map();

  for (const s of categories.proven) {
    bonusMap.set(s.source, s.priority_bonus);
    statusMap.set(s.source, 'proven');
  }
  for (const s of categories.exploration) {
    bonusMap.set(s.source, s.priority_bonus);
    statusMap.set(s.source, s.status === 'candidate' ? 'candidate' : 'new');
  }
  for (const s of categories.rejected) {
    bonusMap.set(s.source, 0);
    statusMap.set(s.source, 'rejected');
  }

  for (const [source, s] of Object.entries(sourceStatus.sources)) {
    if (!bonusMap.has(source)) continue;
    s.priority_bonus = bonusMap.get(source);
    s.exploration_status = statusMap.get(source);
  }

  // Global stats
  sourceStatus.exploration_stats = sourceStatus.exploration_stats || {};
  const allSources = Object.values(sourceStatus.sources);

  sourceStatus.exploration_stats.total_sources = Object.keys(sourceStatus.sources).length;
  sourceStatus.exploration_stats.proven_sources = allSources.filter(s => s.exploration_status === 'proven').length;
  sourceStatus.exploration_stats.exploration_sources = allSources.filter(s => ['new', 'candidate'].includes(s.exploration_status)).length;
  sourceStatus.exploration_stats.rejected_sources = allSources.filter(s => s.exploration_status === 'rejected').length;
  sourceStatus.exploration_stats.last_analysis = new Date().toISOString();

  return sourceStatus;
}

// Основная функция
function runWeeklyAnalysis() {
  console.log('🔍 Запуск еженедельного анализа источников...');

  const { sourceStatus, userFeedback } = loadSourceData();

  // 1) Analyze
  const performance = analyzeSourcePerformance(sourceStatus, userFeedback);
  const categories = updateSourceStatuses(performance);

  // 2) Queue new sources (so stats include them)
  let nextStatus = ensureRecommendedSourcesQueued(sourceStatus);

  // 3) Update priorities + stats
  nextStatus = applyPriorityUpdates(nextStatus, categories);

  // 4) Report
  const report = generateWeeklyReport(categories, nextStatus);
  const reportFile = path.join(__dirname, `weekly-analysis-${new Date().toISOString().slice(0, 10)}.md`);
  fs.writeFileSync(reportFile, report);

  // 5) Persist updated tracking
  fs.writeFileSync(SOURCE_TRACKING_FILE, JSON.stringify(nextStatus, null, 2));

  console.log(`✅ Анализ завершен! Отчет сохранен: ${path.basename(reportFile)}`);
  console.log(`📊 Proven: ${categories.proven.length}, Exploration: ${categories.exploration.length}, Rejected: ${categories.rejected.length}`);
}

if (process.argv[1] === __filename) {
  runWeeklyAnalysis();
}

export { runWeeklyAnalysis, analyzeSourcePerformance, updateSourceStatuses };
