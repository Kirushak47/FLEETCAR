FleetPilot V19.1 — Return Assignment Cleanup Fix

Исправлено:
- После подтверждённого возврата автомобиля текущая связь водитель↔автомобиль очищается сразу.
- Очищаются driverUserId, driverEmail, driverName, driverPhone, driverAssignedAt и активная revision.
- История Vehicle Handover при этом сохраняется.
- Компания → Водители больше не восстанавливает автомобиль из старого car.driverUserId.
- Driver Picker больше не показывает возвращённую машину как выбранную.
- Старые assignment-строки сверяются с Vehicle Handover: если возврат произошёл после назначения, строка считается закрытой.
- Терминальные состояния returned/cancelled/taken_by_company/forced_return/closed не считаются активным назначением.

После возврата ожидаемый результат:
- Driver Portal: автомобиля нет.
- Компания → Водители: Без автомобиля.
- Редактирование автомобиля: Водитель не назначен.
- Vehicle Handover: история возврата сохранена.
