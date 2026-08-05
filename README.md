# FleetPilot V10.5.2 — Password Recovery Fix

SQL выполнять не нужно.

1. Загрузи все файлы на GitHub.
2. Открой:
   https://kirushak47.github.io/FLEETCAR/?v=105200
3. Нажми Ctrl+F5.

Проверь в Supabase:
Authentication → URL Configuration → Redirect URLs

Должен быть разрешён адрес:
https://kirushak47.github.io/FLEETCAR/**

Теперь восстановление работает так:
- пользователь запрашивает письмо;
- ссылка содержит `password-recovery=1`;
- открывается отдельный экран создания нового пароля;
- CRM не показывается;
- пользователь вводит и повторяет новый пароль;
- после сохранения временная recovery-сессия закрывается;
- открывается обычный экран входа.
