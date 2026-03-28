# Changelog

## 1.3.4 (2026-03-17)
- Fix: ضبط عرض مديونية المورد في صفحة الاستلام/المرتجعات ليعكس مفهوم الدين بشكل صحيح (حتى مع الأرصدة السالبة).
- Fix: صفحة إنشاء الأوردر اليدوي أصبحت تعرض المنتج مرة واحدة فقط مع تسلسل اختيار صحيح: المنتج ← المقاس ← اللون.
- Update: إعادة ترتيب نموذج سداد المورد في صفحة الإيراد/المصروف وإضافة حقول قراءة فقط للحساب الحالي والمتبقي بعد السداد.
- Fix: تصحيح معادلة "المبلغ المتبقي للمورد" في صفحة الإيرادات والمصروفات عند الرصيد السالب، بحيث يقل المتبقي باتجاه الصفر بعد السداد بدل زيادة السالب.
- Fix: توحيد اتجاه احتساب "سداد المورد" بين الماليات وصفحة الموردين وكشف الحساب اعتمادًا على الإشارة الفعلية للمبلغ، لمنع زيادة الرصيد بالخطأ بعد السداد.
- Fix: توحيد قاعدة السداد لتعمل في الحالتين (الرصيد الموجب/السالب) بحيث أي سداد مورد يحرك الرصيد دائمًا باتجاه الصفر في صفحة الموردين وكشف الحساب.
- Hotfix: استقرار احتساب رصيد المورد وكشف الحساب بمنطق ثابت غير متغير عبر الزمن (deterministic mapping) لمنع تغيّر إجماليات المورد بالكامل على بعض قواعد بيانات العملاء.
- Hotfix: إضافة `supplier_balance_before` داخل تفاصيل حركة سداد المورد وقت الحفظ، واستخدامه لتحديد اتجاه أثر السداد بدقة (نحو الصفر) في قائمة الموردين وكشف الحساب.
- Hotfix: تنفيذ تسوية تلقائية لمرة واحدة بعد التحديث لإعادة ضبط `total_credit/total_debit` لكل الموردين من دفتر الحركات، لضمان تطابق صفحة الموردين مع كشف الحساب على قواعد البيانات القديمة.
- Hotfix: توحيد عرض أعمدة كشف المورد في الواجهة بحيث `فاتورة شراء` تظهر دائمًا في الدائن (له) و`مرتجع/سداد` في المدين (لنا)، مع توحيد وصف الرصيد النهائي ليتطابق مع صفحة الموردين (`له/عليه/متزن`).
- Fix: تحسين عرض معاملات الماليات بعد الحفظ (تصفية سجل العمليات المالية + إظهار فوري للمعاملة الجديدة عند الحاجة).
- Fix: إصلاح كشف حساب المورد ليتعامل مع التاريخ المحلي بشكل صحيح بدل UTC لتفادي اختفاء حركات اليوم.
- Fix: جعل API كشف حساب المورد متوافقًا مع قواعد البيانات التي لا تحتوي على العمود `transactions.created_by` لمنع Fatal error.

## 1.3.3 (2026-03-16)
- Update: توحيد الإصدار الحالي للمشروع على `1.3.3` وتحديث إعدادات التحديث الذاتي لاستخدام حزمة `DragonPro_v1.3.3.zip`.
- Fix: صفحة إنشاء الأوردر اليدوي تعرض المنتجات بدون تكرار، مع تسلسل اختيار صحيح: المنتج ← المقاس ← اللون.

## 1.3.2 (2026-03-16)
- Fix: توحيد ومعالجة حفظ المرتجع من صفحة `تسجيل المرتجعات` بحيث يستخدم `rep_id` الصحيح الخاص بالأوردر نفسه لتفادي فشل الحفظ.
- Fix: توحيد حسابات المرتجع في `إغلاق اليومية` بين الكروت والتفاصيل مع دعم أدق للـ `partial_return` و`full_return`.
- Update: عرض **عدد القطع المرتجعة** داخل كارت `إجمالي مرتجع`.
- Update: احتساب وعرض قيم `إجمالي التسليم` و`المؤجل` بصافي القيمة **بدون مصاريف الشحن** في الكروت والتفاصيل.
- Update: تحسين تتبع بيانات المرتجع في backend عبر `rep_journal_orders` وحقول `returned_pieces/returned_value` مع fallback آمن للحالات التاريخية.

## 1.3.1 (2026-03-14)
- Feature: صفحة الاستلام تعرض الآن حقل "سعر التكلفة الجديد" بشكل واضح مع عرض "متوسط التكلفة المتوقع" قبل الحفظ.
- Fix: عند حفظ إذن الاستلام يتم تحديث `cost_price` بمتوسط تكلفة مرجّح (Weighted Average) للمنتجات والخامات والإكسسوارات.
- Feature: صفحة تأكيد الأوردرات تدعم حذف الأوردر من "الأوردرات الحالية" واسترجاع الأوردر من "الأوردرات الملغية" مع إعادة الحالة السابقة.
- Fix: دورة اليومية أصبحت أدق — لا إغلاق بدون يومية مفتوحة، والسماح بإغلاق بمبلغ 0، وإغلاق جميع اليوميات المفتوحة للمندوب لتفادي بقاء يومية قديمة.

## 1.3.0 (2026-03-13)
- Release: إصدار تجميعي شامل يتضمن جميع إصلاحات وتحسينات الإصدارات السابقة حتى 1.2.9 في حزمة مستقرة واحدة.
- Fix: حفظ إعداد purchase_price_type في قاعدة البيانات مع استمرار عمل التحقق من السعر في الاستلام والمرتجع حسب نوع السعر المختار.
- Fix: عزل قرارات صفحة تأكيد الأوردرات بحيث لا تؤثر على حالة الأوردر إلا في حالة الإلغاء، مع دعم تصفير يومي لتكليفات التأكيد.
- Fix: تحسين دورة اليومية بإضافة الحالات المطلوبة (pending, returned, postponed, cancelled) بما يضمن توافق التشغيل اليومي.
- Fix: تحسين نظام التحديثات لالتقاط ملف ZIP بالاسم المحدد أولاً ثم fallback لأي ZIP داخل الإصدار لتحسين توافق الإصدارات القديمة.
- Update: استعادة عرض جميع الإصدارات في نافذة التحديثات مع إبقاء حالة توفر ZIP واضحة لكل إصدار.
- Update: إبقاء شريط العنوان على الرابط الأساسي بدون hash أثناء التنقل داخل التطبيق.
- Feature: إضافة أدوات دعم التحديث للعملاء تشمل التثبيت التلقائي المتسلسل للتحديثات وصفحة مساعدة لتفعيل php_zip.

## 1.2.9 (2026-03-13)
- Fix: نظام فحص التحديثات أصبح يطابق ملف ZIP المراد أولاً ثم يعمل fallback تلقائي لأي ملف ZIP داخل نفس الإصدار، مما يحسن توافق الإصدارات القديمة ذات أسماء ملفات مختلفة.
- Fix: تمت استعادة عرض جميع الإصدارات في نافذة التحديثات كما كان سابقاً مع استمرار إظهار حالة "لا يوجد ملف ZIP" فقط عند عدم وجود ملف فعلي.
- Fix: إزالة hash من عنوان المتصفح أثناء التنقل داخل التطبيق، ليبقى الرابط على `http://localhost:3000/` دون `#/...`.
- Update: تجهيز الإصدار `v1.2.9` للنشر مع تحديث ملفات النسخة والتحديث التلقائي.

## 1.2.8 (2026-03-13)
- Fix: حفظ إعداد "سعر الشراء في الاستلام والمرتجع" (purchase_price_type) في قاعدة البيانات — كان يُحفظ في localStorage فقط ولا يُستعاد بعد مسح المتصفح.
- Fix: التحقق من أن سعر التكلفة / سعر المصنعية أكبر من صفر في إذن الاستلام وإذن المرتجع يعمل الآن بشكل صحيح بعد حفظ الإعداد في DB.
- Fix: صفحة تأكيد الأوردرات — أصبحت القرارات (تأكيد / تأجيل) لا تُغيّر حالة الأوردر؛ فقط الإلغاء يُغيّر الحالة إلى "ملغي".
- Fix: صفحة تأكيد الأوردرات — تُمسح التكليفات القديمة تلقائياً يومياً (تصفير يومي) وتظهر فقط تكليفات اليوم الحالي.
- Fix: صفحة بدء اليومية — تقبل الآن الأوردرات بحالة "مؤجل" إلى جانب "قيد الانتظار" و"مرتجع".
- Fix: صفحة إدارة الأوردرات — تكبير خانة تصفية الحالة مع القائمة المنسدلة.

## 1.2.7 (2026-03-08)
- Feature: إضافة إعداد "سعر الشراء" في الإعدادات لتحديد طريقة تسعير الشراء في إذن الاستلام وإذن المرتجع.
	- خيار "سعر التكلفة الكامل" → يظهر حقل تكلفة المخزن فقط.
	- خيار "سعر المصنعية" → يظهر حقل سعر المورد/المصنع فقط.
	- ينطبق الخيار على صفحة الاستلام وصفحة المرتجع وحسابات الإجمالي.
- Feature: إضافة صفحة `تأكيد الاوردرات` بمسار تشغيل سريع يعتمد على الباركود وربط مباشر بالمندوب.
	- دعم إسناد الأوردرات المسموح بها فقط (`pending` و`returned`) مع منع التضارب بين المناديب.
	- دعم تجهيز الحالات مرحلياً إلى `مؤكدة` و`مؤجلة` و`ملغية` ثم حفظها دفعة واحدة.
	- تحسين الرسائل العربية وحالات المنع عند وجود الأوردر `مع المندوب` أو داخل يومية المندوب.
	- إضافة أزرار `حفظ` و`مسح` وتحسين تصميم بطاقات التنفيذ والملخصات.

## 1.1.5 (2026-02-14)
- Fix: Print layout improvements — larger company logo and barcode for clearer printouts.
- Fix: Corrected totals calculation to always use product line (price * quantity) when printing.
- Update: Print CSS adjusted so each printed order fills A4 page height and footer/policy aligns to bottom.
- Misc: Prepare release metadata and bumped package/version files to `1.1.5`.

## 1.1.4 (2026-02-14)
- Internal: previous quick fixes and sync (internal build alignment).

## 1.0.7 (2026-02-12)
- Hotfix: Prevent further api.php fatals by adding missing helpers used by orders import/journal/transfer flows.
- Release prep (2026-02-13): include DB reconciliation migrations and validation.
	- Migrations: `migrations/20260213_add_missing_tables_from_schema.sql` and `migrations/run_updates.php`.
	- Action: run the CREATEs first, then run `php migrations/run_updates.php` to apply conditional ALTERs on MySQL 5.7.

## 1.0.6 (2026-02-12)
- Hotfix: Fix fatal error on importing/saving orders due to missing `normalize_tax_discount_type()` in api.php.

## 1.0.5 (2026-02-12)
- Hotfix: Fix fatal error on saving/importing orders due to missing `get_setting_value()` in api.php.

## 1.0.4 (2026-02-11)
- Representatives insurance deposit system ("تأمين المناديب"):
	- Adds insurance fields to reps/users and prevents deleting reps when insurance exists.
	- Fixed dedicated treasury for insurance ("تأمين المناديب") with auto-creation and backward-compat safeguards.
	- Hide/disable insurance-related UI/treasury when reps are disabled via delivery method settings.
	- Locks insurance fields from editing when modifying an existing representative.
- Representative finance ("ماليات المندوب") improvements:
	- Adds settlement flow with corrected accounting: cash moves only through the selected treasury.
	- Net settlement is calculated as balance + insurance, then insurance is cleared via an internal adjustment and insurance fields are zeroed.
	- Adds internal transaction subtypes for rep penalty and insurance apply that do not require a treasury entry.
	- Hardens validation and error messages (e.g., insufficient treasury balance handling).
- New "أداء المناديب" page under Representatives menu:
	- Date presets (day/week/month/year) + specific-date mode.
	- Filter by a specific rep or all reps.
	- Top 10 representatives ranking.
	- Removes the old "أداء المندوب" box from the representative finance page.
- Backend reliability fixes:
	- Safer DB transaction handling (begin/commit/rollback guards).
	- Compatibility/self-healing schema checks for older installs to avoid missing-column failures.

## 1.0.3 (2026-02-09)
- POS as a standalone page that records real sales (stock + customer balance + treasury).
- Cash-customer flow with auto-paid behavior and improved receipt details (customer/paid/remaining).
- Delivery method setting (reps/direct/shipping) with UI gating and routing.
- Shipping Companies module and shipping-mode parity across sales screens.

## 1.0.2 (2026-02-09)
- Add in-app technical support section (RustDesk quick actions) in Settings.

## 1.0.0 (2026-02-09)
- Initial public release.
- Auto-update via GitHub Releases (server-side apply).
- Installer and schema reliability improvements.
- Permissions and representative access rules.
- Subfolder-safe asset paths and improved dev/prod API base-path handling.
