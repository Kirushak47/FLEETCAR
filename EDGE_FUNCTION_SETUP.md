# Настройка настоящих email-приглашений

## 1. Создать Edge Function через Supabase Dashboard

1. Открой Supabase.
2. Слева выбери **Edge Functions**.
3. Нажми **Deploy a new function** или **Create function**.
4. Название функции: `invite-member`.
5. Открой файл:
   `supabase/functions/invite-member/index.ts`
6. Скопируй его содержимое целиком в редактор функции.
7. Нажми **Deploy function**.

Проверка JWT должна оставаться включённой.

## 2. Добавить Redirect URL

Authentication → URL Configuration → Redirect URLs:

`https://kirushak47.github.io/FLEETCAR/**`

Также можно добавить точный адрес:

`https://kirushak47.github.io/FLEETCAR/?invited=1`

## 3. Добавить secret для адреса возврата

Edge Functions → Secrets:

- Name: `APP_REDIRECT_URL`
- Value: `https://kirushak47.github.io/FLEETCAR/?invited=1`

Встроенные `SUPABASE_URL`, `SUPABASE_ANON_KEY` и
`SUPABASE_SERVICE_ROLE_KEY` уже доступны размещённым Edge Functions.
Секретный ключ нельзя копировать в `cloud-config.js`.

## 4. Загрузить FleetPilot на GitHub

Открой:

`https://kirushak47.github.io/FLEETCAR/?v=101100`

После этого кнопка приглашения вызовет Edge Function.

## Важно

Встроенная почта Supabase имеет строгий тестовый лимит. Для коммерческой
работы подключи собственный SMTP в Authentication → Emails → SMTP Settings.
