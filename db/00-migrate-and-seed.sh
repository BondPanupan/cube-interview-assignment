#!/bin/sh
set -e

for file in /docker-entrypoint-initdb.d/migrations/*.sql; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$file"
done

for file in /docker-entrypoint-initdb.d/seeds/*.sql; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$file"
done

