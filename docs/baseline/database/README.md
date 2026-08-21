# Exports de schema del baseline

Esta carpeta contiene únicamente definiciones DDL generadas con `pg_dump --schema-only --no-owner --no-privileges`.

- No incluye filas ni valores de tablas.
- No incluye contraseñas ni valores de credenciales.
- No sustituye el backup completo requerido por `PH01-T002`.
- Los archivos se conservan para comparar drift y probar la reconstrucción del schema.

El inventario, conteos, clasificación y resultados de validación están documentados en `../database.md`.
