# FleetPilot V14.2.4 — Navigation Fix

- Восстановлена глобальная функция `openCar()` для всех переходов в профиль автомобиля.
- Исправлены переходы из документов, календаря, аналитики, сервиса и карточек автопарка.
- Сохранена маршрутизация на конкретную вкладку автомобиля.
- Обновлён cache-busting до `142400`.

# FleetPilot V14.2.2 — Service Wrench Fix

- Финансы конкретного автомобиля разделены на факт, план, доход и чистый результат.
- Добавлены периоды: месяц / квартал / год.
- Плановые сервисные расходы и ремонты не дублируются, если они связаны одной записью.
- Фактические сервисные расходы учитываются через существующую финансовую нормализацию без двойного списания.
- Добавлены структура результата, будущие расходы и прогноз после текущего плана.
- Сохранены исправления Vehicle Core V14.1.0.

## V14.1.3 layout fix
- Finance blocks are now arranged in two independent vertical columns on desktop, so a taller card no longer creates an empty gap under the shorter card beside it.
- The layout collapses to one dense column on narrower screens.
- No finance logic was changed in this patch.


## V14.1.3 detailed calculation
- Added “Подробный расчёт” inside the existing Analytics tax/profit block.
- Shows earnings, actual expenses, VAT breakdown, PIT/ryczałt, contributions, total obligations and remaining result.
- Uses the same active tax profile and period as the current Analytics calculation.
- Report opens in-app and can be printed / saved as PDF from the browser.


## V14.1.4 Expense Drilldown
- Факт расходов и План расходов открываются в отдельном информационном окне.
- Категории, операции, процент от дохода, переход к исходной записи.
- CSV и печать/PDF.
- Исправлен период Квартал в финансовых расчётах автомобиля.


## V14.2.1 Smart Calendar
- Новый режим календаря: Месяц / Неделя / День.
- Стрелки листают именно активный период.
- События группируются по дням и открывают связанный объект.
- Типы событий визуально различаются, а календарь показывает количество и типы событий по дням.
- Старый длинный диапазон заменён реальным календарным периодом.


## V14.2.2 Service Wrench Fix
- Fleet wrench appears only when the vehicle has a real active repair or a new/accepted driver request.
- Requests already transferred to service (cloud status `repair`) no longer light the wrench by themselves.
- Done/cancelled/rejected/archived/closed repairs are excluded from the fleet service indicator.
