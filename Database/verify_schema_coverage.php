<?php
// Verify all migration-added items are present in current_schema_struct.sql
$schemaFile = __DIR__ . '/../current_schema_struct.sql'; // file is in project root
$schema = file_get_contents($schemaFile);

$checks = [
    // orders columns from migrations
    'orders.discount_type'         => 'discount_type',
    'orders.discount_value'        => 'discount_value',
    'orders.tax_type'              => 'tax_type',
    'orders.tax_amount'            => 'tax_amount',
    'orders.employee'              => '`employee`',
    'orders.page'                  => '`page`',
    'orders.items_json'            => 'items_json',
    // products columns
    'products.is_archived'         => 'is_archived',
    'products.created_at'          => '`created_at`',
    // transactions columns
    'transactions.category'        => '`category`',
    'transactions.created_by'      => '`created_by`',
    // treasuries column
    'treasuries.type'              => '`type`',
    // tables added via migrations
    'TABLE: app_settings'          => 'CREATE TABLE `app_settings`',
    'TABLE: app_files'             => 'CREATE TABLE `app_files`',
    'TABLE: app_feedback'          => 'CREATE TABLE `app_feedback`',
    'TABLE: selected_products'     => 'CREATE TABLE `selected_products`',
    'TABLE: rep_daily_journal'     => 'CREATE TABLE `rep_daily_journal`',
    'TABLE: rep_close_events'      => 'CREATE TABLE `rep_close_events`',
    'TABLE: rep_delivery_sessions' => 'CREATE TABLE `rep_delivery_sessions`',
    'TABLE: rep_journal_orders'    => 'CREATE TABLE `rep_journal_orders`',
    'TABLE: rep_return_events'     => 'CREATE TABLE `rep_return_events`',
    'TABLE: delivery_notes'        => 'CREATE TABLE `delivery_notes`',
    'TABLE: delivery_note_lines'   => 'CREATE TABLE `delivery_note_lines`',
    'TABLE: product_variants'      => 'CREATE TABLE `product_variants`',
    'TABLE: order_confirmation_assignments' => 'CREATE TABLE `order_confirmation_assignments`',
    'TABLE: user_preferences'      => 'CREATE TABLE `user_preferences`',
    // attendance tables
    'TABLE: attendance_logs'       => 'CREATE TABLE `attendance_logs`',
    'TABLE: attendance_devices'    => 'CREATE TABLE `attendance_devices`',
    // permissions tables
    'TABLE: permission_modules'    => 'CREATE TABLE `permission_modules`',
    'TABLE: permission_actions'    => 'CREATE TABLE `permission_actions`',
    // other important tables
    'TABLE: journal_entries'       => 'CREATE TABLE `journal_entries`',
    'TABLE: inventory_audits'      => 'CREATE TABLE `inventory_audits`',
    'TABLE: rep_cash_custody'      => 'CREATE TABLE `rep_cash_custody`',
];

echo "\n=== MIGRATION COVERAGE CHECK ===\n";
echo "Schema file: " . basename($schemaFile) . " (" . round(filesize($schemaFile)/1024, 1) . " KB)\n\n";

$ok = 0;
$missing = 0;
foreach ($checks as $label => $pattern) {
    if (strpos($schema, $pattern) !== false) {
        echo "  [OK]      $label\n";
        $ok++;
    } else {
        echo "  [MISSING] $label\n";
        $missing++;
    }
}

echo "\n";
echo "Result: $ok OK, $missing MISSING out of " . count($checks) . " checks\n";
if ($missing === 0) {
    echo "✅ ALL GOOD - current_schema_struct.sql contains EVERYTHING from migrations!\n";
} else {
    echo "❌ SOME ITEMS MISSING - need review!\n";
}
