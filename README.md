# FleetPilot V15.5 — Auth & Mobile Navigation Fix

- Исправлен критический баг: селектор прав больше не скрывает `<body>` через `data-enterprise-role`.
- После выхода из аккаунта всегда открывается форма входа без пустого экрана.
- Нижнее мобильное меню возвращено к проверенной схеме: все разрешённые текущей ролью разделы находятся в одной горизонтально прокручиваемой панели.
- Мобильная версия использует те же разрешения роли, что desktop; отдельной мобильной матрицы прав нет.
- Если пункт запрещён существующей ролью/администратором, он скрыт; разрешённые пункты не теряются из-за лимита 4/5 кнопок.
- Сохранены Vehicle Core responsive fixes, Documents UI, сервис, финансы и синхронизация документов.


## V15.5 — Stable Mobile Menu
- restored static bottom navigation architecture from the stable pre-V15 implementation;
- role permissions only hide/show existing menu items;
- removed dynamic recreation/removal of mobile menu buttons;
- active item automatically scrolls into view;
- desktop and mobile use the same existing permission checks;
- preserves V15.4 auth/logout fixes.
