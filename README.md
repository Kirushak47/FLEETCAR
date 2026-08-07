# FleetPilot V15.8 — Flat Modular + Mobile Navigation

Эта версия основана на V15.6 Modular Codebase и включает мобильное меню из V15.7.

## Главное

Все JS/CSS модули теперь лежат В КОРНЕ репозитория. Для будущих патчей не нужно создавать папки `js/` или `css/` через GitHub Web.

## Карта JS-модулей

- `fp-core-data.js` — база данных, загрузка/сохранение, автомобили, общие функции, demo.
- `fp-roles-company.js` — роли, разрешения, компания и мобильное меню «Ещё».
- `fp-driver-portal.js` — интерфейс водителя.
- `fp-router-navigation.js` — роутинг, URL, переходы, общая навигация.
- `fp-files-backups.js` — файлы, резервные копии, восстановление.
- `fp-analytics-dashboard.js` — Dashboard, KPI, аналитика.
- `fp-gps-map.js` — GPS и карта.
- `fp-fleet.js` — автопарк и карточки автомобилей.
- `fp-service-finance.js` — сервис, ремонты, расходы, оплаты.
- `fp-calendar-vehicle.js` — календарь, профиль автомобиля, Vehicle Core.
- `fp-actions-documents.js` — документы, формы и действия.
- `fp-boot-hotfixes.js` — запуск приложения и совместимые hotfix.

## Карта CSS

- `fp-base.css` — базовые/legacy стили.
- `fp-service-layout.css` — layout сервиса.
- `fp-desktop-gps.css` — desktop/GPS стили.
- `fp-cloud-roles.css` — роли и cloud UI.
- `fp-driver.css` — водительский интерфейс.
- `fp-crm-service.css` — CRM/service UI.
- `fp-current-ui.css` — актуальные стили V14–V15, responsive, mobile, Vehicle Core, документы и новое нижнее меню.

## Мобильное меню

- До 5 разрешённых разделов: показываются все.
- Больше 5: четыре основных пункта + `Ещё`.
- `Ещё` открывает bottom sheet со всеми остальными разделами, доступными текущей роли.
- Права берутся из существующей системы ролей CRM.

## Как ставить эту версию

Эту версию нужно один раз загрузить целиком, потому что `index.html` теперь подключает модули из корня.

После V15.8 будущие патчи можно загружать простым заменением 1–3 файлов прямо в корне GitHub. Например:

- `fp-roles-company.js`
- `fp-current-ui.css`

Никакие папки для таких патчей создавать не потребуется.
