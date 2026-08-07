# FleetPilot V14.1.3 — Vehicle Finance

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
