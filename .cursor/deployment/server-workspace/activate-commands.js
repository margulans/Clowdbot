// Активация команд Dual Rating в текущем агенте
const handler = require('./integrated-agent-handler.js');

// Создаем tools для текущего агента
const tools = {
    message: message,
    web_search: web_search, 
    memory_store: memory_store,
    memory_recall: memory_recall
};

// Экспортируем функции в глобальный scope
global.handleSmartDigestCommand = async (userMessage, userId) => {
    return await handler.handleUserCommand(userMessage, userId, tools);
};

global.handleSmartDigestEvent = async (eventText) => {
    return await handler.handleSystemEvent(eventText, tools);
};

console.log('✅ Dual Rating команды активированы в агенте!');
console.log('📱 Доступные команды: /smart_digest, /rating_report, /system_status');
console.log('⚡ Системные события: createScheduledSmartDigest, daily_reflection');

module.exports = { handler, tools };