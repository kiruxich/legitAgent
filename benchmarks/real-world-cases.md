# Реальные случаи в рабочем бенчмарке

Обновлено 8 сентября 2026 года.

**Все 12 источников добавлены в `corpus.json` и выполняются командой `pnpm benchmark`.** Теперь в наборе 52 исходных случая: 40 синтетических и 12 из реальных проектов. Пять форматных вариантов дают 260 сценариев; вклад реальных источников — 12 независимых групп.

Для каждого источника сохранены SHA, лицензия, атрибуция, изменения при обезличивании, хеши исходников/фикстур и обоснование технической разметки. [Реестр](real-world-candidates.json) связан с рабочими фикстурами; подробности каждого импорта доступны в таблице.

## Что уже проверяется

| Источник и импорт | Покрытие | Лицензия |
| --- | --- | --- |
| [vas3k/vas3k.club](https://github.com/vas3k/vas3k.club/blob/86126cdc4db7566bf0f9bab44e3657c34ddaed93/frontend/html/auth/join.html#L15-L33) · [фикстура](real-world/vas3k-join/SOURCE.md) | Email, обязательное неотмеченное согласие и ссылка через Django URL tag. Проверяются три правила формы и четыре технических признака. | [MIT](https://github.com/vas3k/vas3k.club/blob/86126cdc4db7566bf0f9bab44e3657c34ddaed93/LICENSE) |
| [usememos/memos](https://github.com/usememos/memos/blob/d3d0b35231d557feac5d32a018f153405e496564/web/src/components/AppSidebar/QuickFindDialog.tsx#L113-L225) · [фикстура](real-world/memos-search/SOURCE.md) | Поиск заметок с Input-обёрткой: форма распознана, контактных полей нет; правила отсутствия согласия и политики не срабатывают. | [MIT](https://github.com/usememos/memos/blob/d3d0b35231d557feac5d32a018f153405e496564/LICENSE) |
| [immich-app/immich](https://github.com/immich-app/immich/blob/4f503c4b6b7d35ad8c620c6a5ee734eeed357732/web/src/routes/auth/register/+page.svelte#L28-L80) · [фикстура](real-world/immich-admin-registration/SOURCE.md) | Email/имя в Svelte-компонентах распознаются. Согласия и заранее отмеченного согласия нет; правовое основание регистрации не оценивается. | [AGPL-3.0](https://github.com/immich-app/immich/blob/4f503c4b6b7d35ad8c620c6a5ee734eeed357732/LICENSE) |
| [hoppscotch/hoppscotch](https://github.com/hoppscotch/hoppscotch/blob/ac145e7f758151b41fd46d3e5f513886ce9068ba/packages/hoppscotch-common/src/components/firebase/Login.vue#L44-L118) · [фикстура](real-world/hoppscotch-email-login/SOURCE.md) | Распознаётся email в HoppSmartInput. Checkbox отсутствует. Условная ссылка в другом режиме модального окна не засчитывается как ссылка внутри email-формы. | [MIT](https://github.com/hoppscotch/hoppscotch/blob/ac145e7f758151b41fd46d3e5f513886ce9068ba/LICENSE) |
| [nextcloud/contacts](https://github.com/nextcloud/contacts/blob/986f82595218b375d12a5236282c8b15aa78b97d/src/components/Ocm/OcmInvitesList.vue#L1-L22) · [фикстура](real-world/nextcloud-invite-search/SOURCE.md) | Поле локального поиска находится вне формы: отсутствие форм и отсутствие соответствующих находок проверяются явно. | [AGPL-3.0-or-later](https://github.com/nextcloud/contacts/blob/986f82595218b375d12a5236282c8b15aa78b97d/COPYING) |
| [opentdf/docs](https://github.com/opentdf/docs/blob/af7de4e687326328330935470932d05074778e38/docusaurus.config.ts#L47-L72) · [фикстура](real-world/opentdf-consent-config/SOURCE.md) | Проверяется ссылка на зарубежного провайдера в конфигурации. Отдельно извлечённый consent-default.js не должен порождать находки о запуске аналитики. | [CC-BY-4.0](https://github.com/opentdf/docs/blob/af7de4e687326328330935470932d05074778e38/LICENSE) |
| [martinus/keto-calculator](https://github.com/martinus/keto-calculator/blob/fa035a5778744f226b96f770cd383703aef02ef2/index.html#L13-L42) · [фикстура](real-world/keto-regional-consent/SOURCE.md) | Проверяется наличие Google-провайдера и ровно один отслеживаемый config-вызов; consent, set и js не считаются отдельными событиями. | [CC-BY-SA-3.0](https://github.com/martinus/keto-calculator/blob/fa035a5778744f226b96f770cd383703aef02ef2/LICENSE.txt) |
| [payloadcms/website](https://github.com/payloadcms/website/blob/b1aaaaf76e7ec52984ef39a6075771c9067d866f/src/components/PrivacyBanner/index.tsx) · [фикстура](real-world/payload-consent-actions/SOURCE.md) | Баннер содержит Dismiss с updateCookieConsent(false), поэтому правило отсутствия отказа не срабатывает. Провайдер и компоненты аналитики сохранены для контекста. | [MIT](https://github.com/payloadcms/website/blob/b1aaaaf76e7ec52984ef39a6075771c9067d866f/LICENSE) |
| [supabase/supabase](https://github.com/supabase/supabase/blob/45199443c8e927f623f758399bdf52796adc6615/packages/ui-patterns/src/ConsentToast/index.tsx) · [фикстура](real-world/supabase-consent-categories/SOURCE.md) | Opt out связан с denyAll; правило отсутствия отказа не срабатывает. Сохранены компоненты настроек, обработчик и адаптер состояния. | [Apache-2.0](https://github.com/supabase/supabase/blob/45199443c8e927f623f758399bdf52796adc6615/LICENSE) |
| [smtchahal/gta-snap-to-jpg](https://github.com/smtchahal/gta-snap-to-jpg/blob/585d9642d851bebbb2026cb398308f0adb5c2365/index.html#L11-L17) · [фикстура](real-world/gta-inert-analytics/SOURCE.md) | В исходных text/plain-блоках нет исполняемых tracker-вызовов; CMP-конфигурация содержит Reject all. | [MIT](https://github.com/smtchahal/gta-snap-to-jpg/blob/585d9642d851bebbb2026cb398308f0adb5c2365/LICENSE) |
| [FreeFeed/freefeed-react-client](https://github.com/FreeFeed/freefeed-react-client/blob/ce74224c64c20eb90be3685d6344758b7e54e8c3/src/components/signup-form.jsx#L17-L29) · [фикстура](real-world/freefeed-unrelated-checkboxes/SOURCE.md) | Подписка на пользователей/группы не считается согласием. Предупреждение об отключённых cookies не считается баннером согласия. | [MIT](https://github.com/FreeFeed/freefeed-react-client/blob/ce74224c64c20eb90be3685d6344758b7e54e8c3/LICENSE) |
| [pretix/pretix](https://github.com/pretix/pretix/blob/edb4069e18d34eb80f290c00cd6eb74bbd499728/src/pretix/presale/templates/pretixpresale/event/checkout_confirm.html) · [фикстура](real-world/pretix-checkout-confirmations/SOURCE.md) | Checked disabled показывает предыдущий ответ; новые подтверждения не отмечены. Данные контакта представлены текстом, а не полями ввода. Проверяется полный шаблон checkout из закреплённого development-коммита. | [AGPL-3.0 with additional terms; mixed-license repository](https://github.com/pretix/pretix/blob/edb4069e18d34eb80f290c00cd6eb74bbd499728/LICENSE) |

Лицензии сторонних фикстур сохранены отдельно от MIT-лицензии сканера. В исполняемых фрагментах заменены рабочие адреса, email-placeholder и ID аналитики. Известные домены провайдеров сохранены там, где они определяют результат распознавания. Имена авторов и публичные ссылки остаются в атрибуции и лицензиях.

## Исправления по результатам импорта

- Django-ссылка с вложенными кавычками теперь распознаётся как ссылка на политику, если URL tag явно называет соответствующий маршрут. Это анализ исходника, а не исполнение URL resolver.
- Компоненты полей вроде HoppSmartInput распознаются по имени и явным атрибутам. Обычный поиск и компоненты, не являющиеся полями, проверены как отрицательные примеры.
- Содержимое script с `type="text/plain"`, JSON и другими неисполняемыми типами исключено из анализа запуска трекеров, включая резервный поиск по тексту.
- Служебные команды `gtag` (`consent`, `set`, `get`, `js`) отделены от `config`/`event`. Вложенное событие в callback всё ещё обнаруживается. Семантика команд сверена с [справочником Google tag](https://developers.google.com/tag-platform/gtagjs/reference).

Записи `probe` в реестре оставлены как исторический результат до импорта и исправлений. Актуальный результат выдаёт `pnpm benchmark`.

## Строгая проверка и варианты

Каждый реальный случай имеет `strict: true`: любая ошибка размеченного правила завершает прогон с ошибкой, даже если общие precision/recall выше порога. Поле `checks` также проверяет количество форм и вызовов, признаки PII/согласия/ссылки и при необходимости находки в конкретном файле. Поэтому пустой результат парсинга не может автоматически пройти отрицательные примеры.

Дополнительные регрессионные тесты меняют смысл исходных случаев: активируют скрипт заменой `text/plain` на JavaScript, отмечают согласие, заменяют маршрут политики и превращают email в поиск. Эти варианты не увеличивают число независимых источников.

`release:check` и бенчмарк используют одну проверку происхождения: сравнивают хеши фикстур и лицензий, сохранённую разметку и группы источников. Повторные представления одного проекта считаются один раз. Для v1 порог остаётся **100 групп**; сейчас их 12.

## Границы покрытия

Фикстуры анализируются как текст. Исходные приложения, внешние SDK, сетевые запросы и пользовательские действия не исполняются. Для Payload и Supabase пока проверяется наличие отказа в исходниках; восстановление выбора, категории, региональные настройки и отзыв согласия требуют отдельных браузерных сценариев. Для GTA проверено исходное неисполняемое состояние, а последующая активация CMP остаётся отдельной задачей.

У OpenTDF сохранены два представления одного источника: фрагмент headTags и извлечённое тело настройки согласия. Это не запуск полной сборки Docusaurus. У Hoppscotch не исполняются компоненты UI и конфигурация окружения. У pretix импортирован development-шаблон с сохранёнными условиями лицензии; результат не приписывается опубликованному релизу.

Разметка касается технических признаков. Отсутствие checkbox в регистрации, входе или checkout не получило положительную метку юридического нарушения. Глобальные правила политики не оцениваются по одному компоненту.

Эти примеры уже использованы для исправления детекторов и относятся к набору разработки и регрессий. Для независимой итоговой оценки нужен отдельный отложенный набор, который не использовался при настройке правил.
