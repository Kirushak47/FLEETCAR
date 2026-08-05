# FleetPilot V10.3.1 — Startup & Role Fix

1. Supabase → SQL Editor → New query.
2. Выполнить `supabase_v10_3_1_startup_role_fix.sql`.
3. Загрузить файлы на GitHub.
4. Открыть:
   https://kirushak47.github.io/FLEETCAR/?v=103100
5. Нажать Ctrl+F5 и войти повторно.

Исправлено:
- `column reference "role" is ambiguous`;
- окно создания автопарка больше не мигает при обновлении;
- Workspace проверяется до показа onboarding;
- левое меню не скрывается во время восстановления сессии;
- права и меню повторно применяются после загрузки роли;
- вход, подтверждение email и облачная синхронизация сохранены.
