# Changelog

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
