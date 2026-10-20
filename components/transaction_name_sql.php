<?php

if (!function_exists('build_transaction_related_name_expr')) {
    function build_transaction_related_name_expr($hasRepresentatives) {
        $detailsRepId = "NULLIF(JSON_UNQUOTE(JSON_EXTRACT(CASE WHEN JSON_VALID(t.details) THEN t.details ELSE NULL END, '$.rep_id')), '')";
        $repLookupId = "COALESCE({$detailsRepId}, t.related_to_id)";
        $repLookup = $hasRepresentatives
            ? "COALESCE((SELECT r.name FROM representatives r WHERE r.id = {$repLookupId} LIMIT 1),(SELECT u.name FROM users u WHERE u.id = {$repLookupId} LIMIT 1))"
            : "(SELECT u.name FROM users u WHERE u.id = {$repLookupId} LIMIT 1)";

        return "CASE
            WHEN t.related_to_type = 'customer' THEN (SELECT c.name FROM customers c WHERE c.id = t.related_to_id LIMIT 1)
            WHEN t.related_to_type = 'supplier' THEN (SELECT s.name FROM suppliers s WHERE s.id = t.related_to_id LIMIT 1)
            WHEN t.related_to_type IN ('rep', 'employee') AND {$detailsRepId} IS NOT NULL THEN {$repLookup}
            WHEN t.related_to_type = 'employee' THEN COALESCE((SELECT e.name FROM employees e WHERE e.id = t.related_to_id LIMIT 1), {$repLookup})
            WHEN t.related_to_type = 'rep' THEN {$repLookup}
            WHEN {$detailsRepId} IS NOT NULL THEN {$repLookup}
            ELSE NULL
        END";
    }
}
