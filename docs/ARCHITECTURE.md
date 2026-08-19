# FleetPilot — карта архитектуры

Этот файл нужен для быстрой ориентации: где начинается приложение, где живут данные, права, файлы и мобильные оболочки, и куда смотреть при конкретном типе бага.

## 1. Точка входа

- `index.html` — основной DOM и базовые экраны CRM.
- `cloud-config.js` — ранняя инициализация Supabase, определение роли, выбор desktop/mobile оболочки и загрузка модулей.
- `sw.js` — Service Worker и PWA cache. Если после обновления на секунду виден старый UI или подтягивается старая логика, первым делом проверять cache key и версии ассетов здесь.

## 2. Основные данные

FleetPilot использует смешанную модель:

- Workspace/Supabase — облачный источник данных для общих сущностей и доступа между устройствами.
- локальный `db` — runtime-состояние приложения и совместимость со старой архитектурой.
- `localStorage` — только настройки интерфейса, локальные метаданные и часть legacy-кэша; не должен быть единственным источником бизнес-данных.
- IndexedDB `FleetPilotFiles` — legacy-хранилище старых вложений. Новые файлы должны идти в Supabase Storage.

Ключевые legacy/runtime файлы:

- `fp-core-data.js` — базовая модель данных и сохранение.
- `cloud.js` — облачная синхронизация Workspace/Supabase.
- `fp-files-backups.js` — резервные копии, legacy IndexedDB и часть служебной логики данных.

## 3. Облачные файлы

Новая файловая архитектура:

- Supabase Storage bucket: `fleet-files`.
- таблица метаданных: `workspace_files`.
- `modules/files/storage.js` — единый API загрузки, списка, открытия, скачивания и удаления.
- `modules/files/document-cloud-bridge.js` — перевод вложений раздела «Документы» на Storage с fallback на старые локальные файлы.
- `modules/files/service-cloud-attachments.js` — произвольные вложения сервисных работ.
- `modules/files/media-cloud-sync.js` — синхронизация legacy-медиа (сервисные фото, повреждения, handover) в Storage.
- `modules/files/documents-file-center.js` — единый архив файлов и истории в разделе «Документы».
- `modules/files/handover-archive-extension.js` — добавление истории приёмки/возврата в единый архив.
- `modules/files/data-page-cloud.js` — облачная информация на странице «Данные».

Правило: новый физический файл должен жить в Storage; в бизнес-сущности хранится только связь/ID/метаданные.

## 4. Автопарк и Fleet Board

- `fp-fleet.js` — основной UI автопарка.
- `modules/fleet/status.js` — нормализация статусов.
- `modules/fleet/board.js` — Fleet Board.
- `modules/drivers/assignment.js` — связь автомобиль ↔ водитель.
- `modules/fleet/mileage.js` — логика пробега.

Операционный статус автомобиля должен быть только одним из:

- `on_line` / «На линии» — автомобиль привязан к водителю;
- `repair` / «В ремонте» — свободный автомобиль переведён в грубый ремонт;
- `free` / «Свободен» — нет водителя и нет статуса ремонта.

Acceptance водителя не должен создавать отдельный статус автомобиля.

## 5. Водители

- `fp-driver-portal.js` — legacy/runtime логика водителей, назначений, приёмки/возврата и заявок.
- `driver-app/app.js` + `driver-app/app.css` — отдельная мобильная оболочка водителя.
- `modules/drivers/state.js` — состояние водителей.
- `modules/drivers/assignment.js` — назначение автомобиля.

Если проблема только на телефоне водителя — сначала смотреть `driver-app/*`, затем `fp-driver-portal.js`, затем права.

## 6. Механик и сервис

- `fp-calendar-vehicle.js` — профиль автомобиля и редактор сервисных работ, включая старые фото до/после.
- `fp-actions-documents.js` — сохранение ремонтов, расходов, документов и связанных действий.
- `fp-service-finance.js` — сервис/финансы.
- `mechanic-app/app.js` + `mechanic-app/app.css` — отдельная мобильная оболочка механика.
- `modules/files/service-cloud-attachments.js` — облачные сервисные вложения.

Если сервисная работа сохраняется неправильно — начинать с `fp-actions-documents.js`. Если неправильно открывается/рисуется — с `fp-calendar-vehicle.js`.

## 7. Права и роли

- `modules/roles/permission-core-v2.js` — центральная проверка прав.
- `modules/roles/live-permissions.js` — применение изменений без перелогина.
- `modules/roles/car-profile-permissions.js` — точечные вкладки профиля автомобиля.
- `fp-roles-company.js` — UI компании/ролей и legacy-часть управления.

Правило: скрыть кнопку недостаточно. Permission должен проверяться и на уровне действия/submit/open.

Если пользователь видит то, чего не должен:
1. проверить Permission Matrix;
2. проверить ключ permission в `permission-core-v2.js`;
3. проверить, что конкретное действие действительно вызывает permission check;
4. проверить live refresh события.

## 8. Навигация и загрузка

- `fp-router-navigation.js` — маршруты и возврат на текущую страницу.
- `modules/router/router.js` — новый слой маршрутизации.
- `modules/core/runtime.js` — runtime API модулей.
- `modules/core/boot.js` — модульный boot.
- `cloud-config.js` — фактическая последовательность подключения новых модулей.

Если при F5 пользователя перебрасывает на «Автопарк» — смотреть router/state restoration, а не Fleet Board.

## 9. PWA / старый интерфейс при обновлении

Если на секунду появляется старая версия:

1. `sw.js` — увеличить `CACHE`;
2. версии `?v=` у изменённых файлов должны совпадать в `cloud-config.js` и `sw.js`;
3. удалить старый модуль из boot, если он больше не должен загружаться;
4. проверить, что старый CSS не подключается раньше нового shell.

Не лечить такой баг дополнительными `setTimeout`, пока не проверен Service Worker.

## 10. Где искать проблему

| Симптом | Начать отсюда |
|---|---|
| Fleet Board неверный статус/цвет/ключ | `modules/fleet/board.js`, `modules/fleet/status.js` |
| Машина не привязывается к водителю | `modules/drivers/assignment.js`, `fp-driver-portal.js`, `cloud.js` |
| При F5 другая страница | `fp-router-navigation.js`, `modules/router/router.js` |
| Механик видит лишнюю вкладку | `modules/roles/permission-core-v2.js` |
| Permission включён, но UI не меняется | `modules/roles/live-permissions.js` |
| Документ есть только на одном ПК | `modules/files/document-cloud-bridge.js`, `modules/files/storage.js` |
| Не открывается файл | `modules/files/storage.js`, `workspace_files`, Storage RLS |
| Сервисный файл не появился | `modules/files/service-cloud-attachments.js` |
| Фото до/после не в облаке | `modules/files/media-cloud-sync.js`, `fp-calendar-vehicle.js` |
| Проблема только в mobile driver | `driver-app/*` |
| Проблема только в mobile mechanic | `mechanic-app/*` |
| Старый UI мелькает при F5 | `sw.js`, `cloud-config.js` |
| Долгая вечная загрузка роли | role-gate в `cloud-config.js` |

## 11. Что пока считается legacy

Наличие legacy-кода само по себе не ошибка. Сейчас совместимость намеренно сохранена, чтобы не потерять старые данные:

- IndexedDB `FleetPilotFiles` — старые вложения;
- base64/dataURL в старых фото полях — резервная совместимость до подтверждённой миграции;
- часть runtime `db` и `localStorage` — старый слой приложения.

Удалять legacy можно только после того, как аудит показывает 0 бизнес-файлов, существующих исключительно локально.

## 12. Правило для следующих обновлений

Новая функция должна иметь один хозяин логики. Не добавлять второй модуль, который параллельно меняет то же состояние, если можно расширить существующий модуль. Для каждого нового типа файла использовать `FleetPilot.Files`, для нового ограничения — Permission Core, для маршрута — Router, для статуса машины — Fleet Status.
