# FleetPilot V15.2 — Responsive UI System

## Главное
- Полный новый mobile-first слой интерфейса: компактная шапка, карточки, формы, модальные окна и нижняя навигация.
- Мобильное меню строится по роли и фактическим разрешениям; лишние разделы скрыты.
- Если доступных разделов больше пяти, дополнительные разделы собраны в «Ещё».
- Матрица разрешений администратора теперь влияет на доступ к страницам и действиям, а не только на подписи в настройках.
- Добавлены разрешения для GPS/карты, календаря и управления данными.
- Ограничены действия создания, редактирования и удаления автомобилей, сервиса, оплат, расходов и документов.
- Владелец workspace сохраняет полный доступ.
- Если матрица прав ещё не настроена, используется прежняя безопасная логика ролей.
- Существующая бизнес-логика сервиса, документов, финансов и Vehicle Core сохранена.
- Cache busting: 152000.
- Responsive fleet cards for wide, normal and compact desktop displays.
- Fluid typography, KPI sizing and action controls.
- Two/three-row fleet layout on smaller desktop monitors to prevent clipping and horizontal overflow.
- Shared responsive guards for Documents, Analytics and other desktop panels.
