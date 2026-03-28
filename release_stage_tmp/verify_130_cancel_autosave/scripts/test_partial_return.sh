# Bash curl example to test partialReturn endpoint
# Usage: bash test_partial_return.sh

API_BASE='http://localhost/Nexus/components'
# Set PHPSESSID if you want to reuse a session: export PHPSESSID=079qg6itd0tk6ohqr7gg8p0vf7

JSON_PAYLOAD='{
  "order_id": 123,
  "rep_id": 45,
  "warehouse_id": 1,
  "notes": "Test partial return",
  "items": [ { "product_id": 987, "returnedQuantity": 1 } ]
}'

COOKIE_HEADER=''
if [ -n "${PHPSESSID:-}" ]; then
  COOKIE_HEADER="-b PHPSESSID=${PHPSESSID}"
fi

curl -s $COOKIE_HEADER -H "Content-Type: application/json" -X POST -d "$JSON_PAYLOAD" "$API_BASE/api.php?module=orders&action=partialReturn" | jq .
