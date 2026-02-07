// Telegram Dual Rating Integration - Интеграция с OpenClaw
// Система двойной оценки источников и экспертов через Telegram реакции

const DualRatingManager = require('./dual-rating-system.js');
const fs = require('fs').promises;
const path = require('path');

class TelegramDualRating {
    constructor(messageApi, targetUserId = 685668909) {
        this.message = messageApi;
        this.userId = targetUserId;
        this.dualRating = new DualRatingManager();
        this.dataFile = 'data/dual-rating-data.json';
        this.channelId = '@newsneiron';
        
        // Загружаем сохраненные данные
        this.loadData().catch(console.warn);
    }

    // Загрузка сохраненных данных
    async loadData() {
        try {
            const data = await fs.readFile(this.dataFile, 'utf8');
            const parsed = JSON.parse(data);
            this.dualRating.importData(parsed);
            console.log('✅ Dual Rating данные загружены');
        } catch (error) {
            console.log('ℹ️ Создаем новую базу Dual Rating');
            await this.initializeDefaultData();
        }
    }

    // Сохранение данных
    async saveData() {
        try {
            const dir = path.dirname(this.dataFile);
            await fs.mkdir(dir, { recursive: true });
            
            const data = this.dualRating.exportData();
            await fs.writeFile(this.dataFile, JSON.stringify(data, null, 2));
            console.log('💾 Dual Rating данные сохранены');
        } catch (error) {
            console.error('❌ Ошибка сохранения Dual Rating:', error);
        }
    }

    // Инициализация базовых источников и экспертов
    async initializeDefaultData() {
        console.log('🏗️ Инициализируем базу источников и экспертов...');
        
        // ИИ источники
        const aiSources = [
            { name: 'OpenAI Blog', url: 'https://openai.com/blog', category: 'AI' },
            { name: 'Anthropic News', url: 'https://anthropic.com/news', category: 'AI' },
            { name: 'DeepMind Blog', url: 'https://deepmind.com/blog', category: 'AI' },
            { name: 'Hugging Face', url: 'https://huggingface.co/blog', category: 'AI' },
            { name: 'Papers With Code', url: 'https://paperswithcode.com', category: 'AI' }
        ];
        
        // Технические источники  
        const techSources = [
            { name: 'TechCrunch', url: 'https://techcrunch.com', category: 'Tech' },
            { name: 'The Verge', url: 'https://theverge.com', category: 'Tech' },
            { name: 'Ars Technica', url: 'https://arstechnica.com', category: 'Tech' },
            { name: 'Habr.com', url: 'https://habr.com', category: 'Tech' },
            { name: 'Hacker News', url: 'https://news.ycombinator.com', category: 'Tech' }
        ];
        
        // Робототехника и eVTOL
        const roboticsEvtolSources = [
            { name: 'IEEE Spectrum', url: 'https://spectrum.ieee.org', category: 'Robotics' },
            { name: 'Vertical Magazine', url: 'https://verticalmag.com', category: 'eVTOL' },
            { name: 'Boston Dynamics', url: 'https://bostondynamics.com/news', category: 'Robotics' },
            { name: 'Joby Aviation', url: 'https://jobyaviation.com/news', category: 'eVTOL' }
        ];
        
        // Добавляем все источники
        [...aiSources, ...techSources, ...roboticsEvtolSources].forEach(source => {
            this.dualRating.addSource(source.name, source.url, source.category);
        });
        
        // Эксперты ИИ
        const aiExperts = [
            { name: 'Андрей Карпатый', handle: '@karpathy', category: 'AI' },
            { name: 'Сэм Альтман', handle: '@sama', category: 'AI' },
            { name: 'Демис Хассабис', handle: '@demishassabis', category: 'AI' },
            { name: 'Ян Лекун', handle: '@ylecun', category: 'AI' },
            { name: 'Джеффри Хинтон', handle: '@geoffreyhinton', category: 'AI' }
        ];
        
        // Эксперты технологий
        const techExperts = [
            { name: 'Илон Маск', handle: '@elonmusk', category: 'Tech' },
            { name: 'Сергей Брин', handle: '@sergeybrin', category: 'Tech' },
            { name: 'Тим Кук', handle: '@tim_cook', category: 'Tech' },
            { name: 'Редакция Habr', handle: '@habr', category: 'Tech' }
        ];
        
        // Робототехника и eVTOL эксперты
        const roboticsExperts = [
            { name: 'Марк Райберт', handle: '@bostondynamics', category: 'Robotics' },
            { name: 'JoeBen Bevirt', handle: '@jobyaviation', category: 'eVTOL' },
            { name: 'Ральф Холлис', handle: '@cmu_ri', category: 'Robotics' }
        ];
        
        // Добавляем всех экспертов
        [...aiExperts, ...techExperts, ...roboticsExperts].forEach(expert => {
            this.dualRating.addExpert(expert.name, expert.handle, expert.category);
        });
        
        await this.saveData();
        console.log('✅ База источников и экспертов инициализирована');
    }

    // Отправка новости с двойной системой оценки
    async sendNewsWithDualRating(newsData, targetChannel = null) {
        const channel = targetChannel || this.channelId;
        
        try {
            // Формируем сообщение с новостью
            const newsMessage = this.formatNewsMessage(newsData);
            
            // Отправляем основное сообщение
            const result = await this.message({
                channel: 'telegram',
                action: 'send',
                target: channel,
                message: newsMessage
            });
            
            if (!result.ok) {
                throw new Error(`Ошибка отправки: ${result.error}`);
            }
            
            // Регистрируем сообщение для отслеживания реакций
            this.dualRating.registerMessage(
                result.messageId,
                result.chatId || channel,
                newsData.source,
                newsData.expert
            );
            
            console.log(`📰 Новость отправлена: ${newsData.source.name} + ${newsData.expert?.name || 'N/A'}`);
            
            return {
                messageId: result.messageId,
                chatId: result.chatId,
                source: newsData.source,
                expert: newsData.expert
            };
            
        } catch (error) {
            console.error('❌ Ошибка отправки новости:', error);
            throw error;
        }
    }

    // Форматирование сообщения с новостью
    formatNewsMessage(newsData) {
        let message = `${newsData.emoji || '📰'} **${newsData.title}**\n\n`;
        
        // Основной текст
        message += `${newsData.content}\n\n`;
        
        // Источник
        message += `📰 **Источник:** ${newsData.source.name}`;
        if (newsData.source.url) {
            message += `\n🔗 ${newsData.source.url}`;
        }
        
        // Экспертное мнение (если есть)
        if (newsData.expert) {
            message += `\n\n💬 **Экспертное мнение:**\n`;
            message += `👤 ${newsData.expert.name}`;
            if (newsData.expert.handle) {
                message += ` (${newsData.expert.handle})`;
            }
            if (newsData.expert.opinion) {
                message += `\n"${newsData.expert.opinion}"`;
            }
        }
        
        // Инструкции по оценке
        message += `\n\n📊 **Оценка:**`;
        message += `\n🔥 Огонь (+10) | 👍 Лайк (+5) | 👎 Дизлайк (-3) | 💩 Мусор (-5)`;
        message += `\n💡 Реакции влияют на рейтинг источников и экспертов`;
        
        return message;
    }

    // Обработка реакции пользователя  
    async handleUserReaction(messageId, reaction, userId, reactionType = 'source') {
        console.log(`👆 Реакция: ${reaction} от ${userId} на ${messageId} (${reactionType})`);
        
        // Обрабатываем только реакции целевого пользователя
        if (userId !== this.userId) {
            return null;
        }
        
        const result = this.dualRating.processReaction(messageId, reaction, userId, reactionType);
        
        if (result) {
            await this.saveData();
            
            // Можно отправить подтверждение (опционально)
            // await this.sendRatingConfirmation(result);
        }
        
        return result;
    }

    // Автоматическое определение типа реакции
    async handleAmbiguousReaction(messageId, reaction, userId) {
        // Для простоты пока считаем, что реакция относится к источнику
        // В будущем можно добавить логику определения контекста
        return await this.handleUserReaction(messageId, reaction, userId, 'source');
    }

    // Генерация дайджеста с умным выбором источников
    async generateSmartDigest(topicPriorities = ['AI', 'Robotics', 'eVTOL', 'Tech']) {
        console.log('🤖 Создаю умный дайджест с Dual Rating...');
        
        const digest = [];
        const newsPerTopic = { AI: 5, Robotics: 3, eVTOL: 2, Tech: 3 };
        
        for (const topic of topicPriorities) {
            const count = newsPerTopic[topic] || 2;
            
            // Получаем все источники этой категории
            const availableSources = Array.from(this.dualRating.sourceRatings.values())
                .filter(s => s.category === topic && s.status !== 'rejected')
                .map(s => s.name);
            
            // Используем Multi-Armed Bandit для выбора
            const selection = this.dualRating.selectSourcesWithBandit(
                availableSources, 
                count, 
                0.3 // 30% exploration
            );
            
            console.log(`${topic}: выбрано ${selection.sources.length} источников (${selection.stats.exploitationCount} proven + ${selection.stats.explorationCount} exploration)`);
            
            // Для каждого выбранного источника генерируем новость
            for (const sourceName of selection.sources) {
                const sourceInfo = this.dualRating.sourceRatings.get(sourceName);
                
                // Имитируем поиск новости (в реальности тут будет поиск)
                const mockNews = {
                    title: `Новость из ${sourceName}`,
                    content: `Актуальная информация по теме ${topic}...`,
                    emoji: this.getTopicEmoji(topic),
                    source: {
                        name: sourceName,
                        url: sourceInfo.url
                    },
                    expert: this.selectBestExpertForTopic(topic),
                    category: topic
                };
                
                digest.push(mockNews);
            }
        }
        
        return digest;
    }

    // Выбор лучшего эксперта для темы
    selectBestExpertForTopic(topic) {
        const availableExperts = Array.from(this.dualRating.expertRatings.values())
            .filter(e => e.category === topic && e.status !== 'rejected');
        
        if (availableExperts.length === 0) return null;
        
        // Выбираем лучшего эксперта или случайного для исследования
        if (Math.random() > 0.3) { // 70% exploitation
            const bestExpert = availableExperts
                .sort((a, b) => b.averageScore - a.averageScore)[0];
            return {
                name: bestExpert.name,
                handle: bestExpert.handle,
                opinion: `Мнение эксперта ${bestExpert.name} по данной теме...`
            };
        } else { // 30% exploration
            const randomExpert = availableExperts[
                Math.floor(Math.random() * availableExperts.length)
            ];
            return {
                name: randomExpert.name,
                handle: randomExpert.handle,
                opinion: `Альтернативное мнение ${randomExpert.name}...`
            };
        }
    }

    // Получение эмодзи для темы
    getTopicEmoji(topic) {
        const emojis = {
            'AI': '🤖',
            'Robotics': '🦾', 
            'eVTOL': '✈️',
            'Tech': '⚡',
            'Business': '💼',
            'Investments': '💰'
        };
        return emojis[topic] || '📰';
    }

    // Отправка полного дайджеста
    async sendFullDigest() {
        console.log('📰 Отправляю полный дайджест с Dual Rating...');
        
        try {
            const digest = await this.generateSmartDigest();
            
            // Заголовок дайджеста
            await this.message({
                channel: 'telegram',
                action: 'send',
                target: this.channelId,
                message: `🌅 **УМНЫЙ ДАЙДЖЕСТ** | ${new Date().toLocaleDateString('ru-RU')}\n🤖 Multi-Armed Bandit | 📊 Dual Rating\n📈 ${digest.length} персонализированных новостей`
            });
            
            // Отправляем каждую новость
            for (let i = 0; i < digest.length; i++) {
                await this.sendNewsWithDualRating(digest[i]);
                
                // Пауза между сообщениями
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // Итоговая статистика
            const report = this.dualRating.generateDualRatingReport();
            await this.message({
                channel: 'telegram',
                action: 'send',
                target: this.channelId,
                message: `📊 **СТАТИСТИКА СИСТЕМЫ:**\n🎯 Источников: ${report.sources.proven} proven + ${report.sources.candidates} candidates\n👥 Экспертов: ${report.experts.proven} proven + ${report.experts.candidates} candidates\n🤖 Exploration rate: 30% | 💪 Exploitation rate: 70%`
            });
            
            console.log('✅ Полный дайджест отправлен с Dual Rating');
            return { success: true, newsCount: digest.length };
            
        } catch (error) {
            console.error('❌ Ошибка отправки дайджеста:', error);
            throw error;
        }
    }

    // Получение отчета системы
    async getSystemReport() {
        const report = this.dualRating.generateDualRatingReport();
        
        let reportText = `📊 **ОТЧЕТ DUAL RATING СИСТЕМЫ**\n\n`;
        
        // Источники
        reportText += `🗞️ **ИСТОЧНИКИ:**\n`;
        reportText += `✅ Proven: ${report.sources.proven}\n`;
        reportText += `🔄 Candidates: ${report.sources.candidates}\n`;  
        reportText += `❌ Rejected: ${report.sources.rejected}\n\n`;
        
        // Топ источники
        reportText += `🏆 **ТОП-5 ИСТОЧНИКОВ:**\n`;
        report.sources.topSources.forEach((source, i) => {
            reportText += `${i+1}. ${source.name} (${source.averageScore.toFixed(1)}⭐, ${source.reactionsCount} реакций)\n`;
        });
        
        // Эксперты
        reportText += `\n👥 **ЭКСПЕРТЫ:**\n`;
        reportText += `✅ Proven: ${report.experts.proven}\n`;
        reportText += `🔄 Candidates: ${report.experts.candidates}\n`;
        reportText += `❌ Rejected: ${report.experts.rejected}\n\n`;
        
        // Топ эксперты
        reportText += `🏆 **ТОП-5 ЭКСПЕРТОВ:**\n`;
        report.experts.topExperts.forEach((expert, i) => {
            reportText += `${i+1}. ${expert.name} (${expert.averageScore.toFixed(1)}⭐, ${expert.reactionsCount} реакций)\n`;
        });
        
        reportText += `\n🤖 **АЛГОРИТМ:** Multi-Armed Bandit (30/70)`;
        reportText += `\n👤 **TARGET USER:** ${this.userId}`;
        reportText += `\n📊 **АКТИВНЫХ СООБЩЕНИЙ:** ${report.system.activeMessages}`;
        
        return reportText;
    }

    // Очистка старых данных
    async cleanup() {
        const cleaned = this.dualRating.cleanupOldMessages();
        await this.saveData();
        return cleaned;
    }
}

module.exports = TelegramDualRating;

// Тестирование
if (require.main === module) {
    console.log('🧪 Тестирование Telegram Dual Rating системы...');
    
    // Мок message API
    const mockMessage = async (params) => {
        console.log(`📱 MESSAGE: ${params.action} to ${params.target}: "${params.message.slice(0, 50)}..."`);
        return { 
            ok: true, 
            messageId: `msg_${Date.now()}`, 
            chatId: params.target 
        };
    };
    
    const testSystem = async () => {
        const telegramRating = new TelegramDualRating(mockMessage);
        
        // Ждем инициализации
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Тестируем отправку новости
        const testNews = {
            title: 'OpenAI выпустил GPT-5',
            content: 'Новая модель превосходит все ожидания...',
            emoji: '🤖',
            source: {
                name: 'OpenAI Blog',
                url: 'https://openai.com/blog/gpt5'
            },
            expert: {
                name: 'Андрей Карпатый',
                handle: '@karpathy',
                opinion: 'Это прорыв в области ИИ!'
            }
        };
        
        const sent = await telegramRating.sendNewsWithDualRating(testNews);
        console.log('✅ Тест отправки новости:', sent.messageId);
        
        // Тестируем реакции
        await telegramRating.handleUserReaction(sent.messageId, '🔥', 685668909, 'source');
        await telegramRating.handleUserReaction(sent.messageId, '👍', 685668909, 'expert');
        
        // Получаем отчет
        const report = await telegramRating.getSystemReport();
        console.log('\n📊 Отчет системы:');
        console.log(report);
        
        console.log('\n✅ Тестирование завершено!');
    };
    
    testSystem().catch(console.error);
}