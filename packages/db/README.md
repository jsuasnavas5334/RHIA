# @rhia/db

Migraciones aditivas y seeds del dominio RHIA. La base activa nunca es el primer destino.

## Orden

1. Restaurar el bundle baseline en PostgreSQL 18 temporal.
2. Aplicar `migrations/0001_domain_v1.sql` con `migration_checksum` calculado desde el archivo.
3. Aplicar `seeds/0001_minimum.sql`.
4. Ejecutar constraints e índices.
5. Descartar el entorno temporal y demostrar un segundo restore limpio.

El script reproducible es `scripts/test-domain-migration.sh`. No existe migration down destructiva; la estrategia de rollback es restore paralelo desde el backup verificado.
