# Обновление временной зоны дайджестов

## Текущая настройка:
- **Временная зона:** Asia/Dubai (UTC+4)
- **Расписание:** 08:00, 13:00, 18:00 по местному времени

## При смене локации:

### Популярные города и их временные зоны:
- **Алматы:** Asia/Almaty (UTC+6)
- **Дубай:** Asia/Dubai (UTC+4)  
- **Москва:** Europe/Moscow (UTC+3)
- **Нью-Йорк:** America/New_York (UTC-5/-4)
- **Лондон:** Europe/London (UTC+0/+1)
- **Токио:** Asia/Tokyo (UTC+9)
- **Сингапур:** Asia/Singapore (UTC+8)

## Команды обновления:

### Для Алматы:
```bash
openclaw cron update 1c292387-c997-46f1-b8a1-e5fd40059713 --schedule "0 8 * * *" --tz "Asia/Almaty"
openclaw cron update ba7c0bf7-f70a-4785-9a4d-4a443d40c4b8 --schedule "0 13 * * *" --tz "Asia/Almaty"  
openclaw cron update 582cc3f0-9941-4e74-ae77-0afac52c6258 --schedule "0 18 * * *" --tz "Asia/Almaty"
```

### Для Москвы:
```bash
openclaw cron update 1c292387-c997-46f1-b8a1-e5fd40059713 --schedule "0 8 * * *" --tz "Europe/Moscow"
openclaw cron update ba7c0bf7-f70a-4785-9a4d-4a443d40c4b8 --schedule "0 13 * * *" --tz "Europe/Moscow"
openclaw cron update 582cc3f0-9941-4e74-ae77-0afac52c6258 --schedule "0 18 * * *" --tz "Europe/Moscow"
```

## Быстрое обновление через Нейрон:

Просто сообщи: "Обнови расписание на [название города]" 

Например:
- "Обнови расписание на Алматы"
- "Обнови расписание на Нью-Йорк" 
- "Обнови расписание на Токио"

## Проверка текущего расписания:
```bash
openclaw cron list
```

## ID задач для обновления:
- **Утренний дайджест:** 1c292387-c997-46f1-b8a1-e5fd40059713
- **Дневной дайджест:** ba7c0bf7-f70a-4785-9a4d-4a443d40c4b8  
- **Вечерний дайджест:** 582cc3f0-9941-4e74-ae77-0afac52c6258