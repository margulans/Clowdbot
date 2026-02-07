// Telegram Webhook Handler - Обработка реакций для Dual Rating системы
// Готовый к использованию webhook endpoint для OpenClaw

const { OpenClawDualRatingSystem } = require('./openclaw-dual-rating-integration.js');

class TelegramWebhookHandler {
    constructor(tools) {
        this.tools = tools;
        this.dualRatingSystem = null;
        this.targetUserId = 685668909;
        this.targetChannel = '@newsneiron';
        this.targetChannelId = '-1003723471488'; // ID канала @newsneiron
        this.validReactions = ['🔥', '👍', '👎', '💩'];
        
        this.initializeDualRating();
    }
    
    async initializeDualRating() {
        if (!this.dualRatingSystem) {
            this.dualRatingSystem = new OpenClawDualRatingSystem(this.tools);
            console.log('✅ Dual Rating система инициализирована для webhook');
        }
    }
    
    // Основной обработчик webhook обновлений
    async handleWebhookUpdate(update) {
        try {
            console.log('📱 Получено Telegram обновление:', JSON.stringify(update, null, 2));
            
            // Обрабатываем различные типы обновлений
            if (update.message_reaction) {
                return await this.handleMessageReaction(update.message_reaction);
            }
            
            if (update.message) {
                return await this.handleMessage(update.message);
            }
            
            if (update.edited_message) {
                return await this.handleEditedMessage(update.edited_message);
            }
            
            // Другие типы обновлений игнорируем
            console.log('ℹ️ Обновление не требует обработки');
            return { processed: false, reason: 'unsupported_update_type' };
            
        } catch (error) {
            console.error('❌ Ошибка обработки webhook:', error);
            return { processed: false, error: error.message };
        }
    }
    
    // Обработка реакций на сообщения
    async handleMessageReaction(messageReaction) {
        const { message_id, chat, user, new_reaction, old_reaction } = messageReaction;
        
        console.log(`👆 Реакция: message_id=${message_id}, user_id=${user.id}, chat_id=${chat.id}`);
        
        // Фильтруем только реакции от целевого пользователя
        if (user.id !== this.targetUserId) {
            console.log(`⏭️ Игнорирую реакцию от пользователя ${user.id} (не целевой)`);
            return { processed: false, reason: 'wrong_user' };
        }
        
        // Фильтруем только реакции в целевом канале
        const chatId = chat.id.toString();
        const chatUsername = chat.username ? `@${chat.username}` : null;
        
        if (chatId !== this.targetChannelId && chatUsername !== this.targetChannel) {
            console.log(`⏭️ Игнорирую реакцию в чате ${chatId}/${chatUsername} (не целевой канал)`);
            return { processed: false, reason: 'wrong_chat' };
        }
        
        // Обрабатываем новые реакции
        if (new_reaction && new_reaction.length > 0) {
            const results = [];
            
            for (const reaction of new_reaction) {
                const emoji = reaction.emoji;
                
                // Проверяем, что это валидная реакция для рейтинга
                if (!this.validReactions.includes(emoji)) {
                    console.log(`⏭️ Игнорирую реакцию ${emoji} (не для рейтинга)`);
                    continue;
                }
                
                console.log(`✅ Обрабатываю реакцию ${emoji} от пользователя ${user.id}`);
                
                // Отправляем в Dual Rating систему
                const result = await this.dualRatingSystem.handleTelegramReaction(
                    message_id.toString(),
                    emoji,
                    user.id
                );
                
                if (result) {
                    console.log(`🎯 Рейтинг обновлен: ${result.source || result.expert} → ${result.newScore.toFixed(1)}⭐`);
                    
                    // Сохраняем в память
                    await this.tools.memory_store({
                        text: `Реакция ${emoji}: ${result.source || result.expert} → рейтинг ${result.newScore.toFixed(1)}`,
                        category: 'preference',
                        importance: 0.6
                    });
                    
                    results.push({
                        emoji: emoji,
                        target: result.source || result.expert,
                        newScore: result.newScore,
                        status: result.status
                    });
                }
            }
            
            return {
                processed: true,
                reactions: results,
                user_id: user.id,
                message_id: message_id
            };
        }
        
        return { processed: false, reason: 'no_new_reactions' };
    }
    
    // Обработка обычных сообщений (для отладки)
    async handleMessage(message) {
        console.log(`💬 Сообщение от ${message.from?.username || message.from?.id}: ${message.text?.slice(0, 50) || '[медиа]'}`);
        
        // Можно добавить обработку команд в канале, если нужно
        return { processed: false, reason: 'message_not_handled' };
    }
    
    // Обработка отредактированных сообщений
    async handleEditedMessage(editedMessage) {
        console.log(`✏️ Отредактировано сообщение ${editedMessage.message_id}`);
        return { processed: false, reason: 'edited_message_ignored' };
    }
    
    // Статистика обработки
    getStats() {
        return {
            targetUserId: this.targetUserId,
            targetChannel: this.targetChannel,
            targetChannelId: this.targetChannelId,
            validReactions: this.validReactions,
            dualRatingInitialized: !!this.dualRatingSystem
        };
    }
}

// Express.js middleware для webhook
function createWebhookMiddleware(tools) {
    const handler = new TelegramWebhookHandler(tools);
    
    return async (req, res) => {
        try {
            const update = req.body;
            
            if (!update) {
                return res.status(400).json({ error: 'No update data' });
            }
            
            const result = await handler.handleWebhookUpdate(update);
            
            // Отвечаем успешно всегда, чтобы Telegram не ретраил
            res.status(200).json({
                ok: true,
                result: result
            });
            
        } catch (error) {
            console.error('❌ Ошибка в webhook middleware:', error);
            
            // Все равно отвечаем успешно
            res.status(200).json({
                ok: false,
                error: error.message
            });
        }
    };
}

// Простая функция для прямого использования
async function handleTelegramWebhook(update, tools) {
    const handler = new TelegramWebhookHandler(tools);
    return await handler.handleWebhookUpdate(update);
}

// Настройка webhook через Telegram Bot API
async function setupTelegramWebhook(botToken, webhookUrl) {
    const axios = require('axios');
    
    try {
        const response = await axios.post(`https://api.telegram.org/bot${botToken}/setWebhook`, {
            url: webhookUrl,
            allowed_updates: ['message', 'message_reaction', 'edited_message']
        });
        
        if (response.data.ok) {
            console.log('✅ Telegram webhook настроен успешно');
            return response.data;
        } else {
            throw new Error(response.data.description);
        }
        
    } catch (error) {
        console.error('❌ Ошибка настройки webhook:', error.message);
        throw error;
    }
}

// Проверка настроек webhook
async function checkWebhookInfo(botToken) {
    const axios = require('axios');
    
    try {
        const response = await axios.get(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
        
        if (response.data.ok) {
            console.log('📊 Информация о webhook:');
            console.log(JSON.stringify(response.data.result, null, 2));
            return response.data.result;
        } else {
            throw new Error(response.data.description);
        }
        
    } catch (error) {
        console.error('❌ Ошибка получения информации о webhook:', error.message);
        throw error;
    }
}

module.exports = {
    TelegramWebhookHandler,
    createWebhookMiddleware,
    handleTelegramWebhook,
    setupTelegramWebhook,
    checkWebhookInfo
};

// Пример использования
if (require.main === module) {
    console.log(`
💡 ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ TELEGRAM WEBHOOK:

// 1. Express.js middleware
const express = require('express');
const { createWebhookMiddleware } = require('./telegram-webhook-handler.js');

const app = express();
app.use(express.json());

const tools = { message, web_search, memory_store, memory_recall };
app.post('/webhook/telegram', createWebhookMiddleware(tools));

app.listen(3000, () => {
    console.log('🚀 Webhook сервер запущен на порту 3000');
});

// 2. Прямое использование функции
const { handleTelegramWebhook } = require('./telegram-webhook-handler.js');

async function processUpdate(update) {
    const tools = { message, web_search, memory_store, memory_recall };
    const result = await handleTelegramWebhook(update, tools);
    console.log('Результат:', result);
}

// 3. Настройка webhook
const { setupTelegramWebhook } = require('./telegram-webhook-handler.js');

await setupTelegramWebhook(
    'YOUR_BOT_TOKEN',
    'https://yourdomain.com/webhook/telegram'
);
`);
}