SELECT name, COUNT(*) AS c
FROM permission_modules
GROUP BY name
HAVING c > 1
LIMIT 20;
