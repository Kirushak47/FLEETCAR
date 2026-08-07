# FleetPilot V17.0 — Enterprise Mobile UI

Полный мобильный редизайн поверх стабильной V16.1. Desktop и бизнес-логика не изменены.

## Основные изменения
- Стабильное меню-drawer из V16.1 сохранено.
- Полностью новая мобильная дизайн-система: header, cards, KPI, forms, dialogs, lists.
- Новый mobile Fleet, Vehicle Core, Service, Documents, Finance, Analytics и Calendar layout.
- Исправлена единая версия приложения: 17.0 / build 170000.
- Service Worker использует новый cache key и новый mobile CSS.
- Safe-area для iPhone и защита от horizontal overflow.

## Установка
Это крупный релиз: загрузить содержимое архива целиком с заменой одноимённых файлов.
После первого открытия желательно один раз обновить страницу. В шапке должно отображаться FleetPilot V17.0.

## Следующие патчи
После V17 большинство mobile UI правок можно будет делать заменой только `fp-mobile-v17.css`; изменения меню/ролей — `fp-roles-company.js`.
