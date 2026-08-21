# Plan seguro de backup y restore — PH01-T002

## Objetivo

Crear backups completos y cifrados de `rhia_core` y `n8n`, almacenarlos fuera del repositorio y demostrar un restore aislado con los mismos conteos críticos.

## Guardas incorporadas

- El script rechaza destinos dentro del repositorio RHIA.
- La passphrase solo se recibe mediante un archivo externo indicado por `RHIA_BACKUP_PASSPHRASE_FILE`.
- El archivo de passphrase debe existir, no estar vacío y tener permisos Unix `600` o una ACL privada de Windows validada por SID.
- Nunca se imprime la passphrase.
- Los dumps usan formato custom de PostgreSQL, compresión gzip y cifrado simétrico AES‑256 mediante GnuPG.
- Los archivos se escriben primero como `.part` y se renombran únicamente después de terminar correctamente.
- El bundle completo se construye en un directorio terminado en `.part` y solo adquiere su nombre definitivo después de generar dumps, conteos, metadata y hashes.
- No se sobrescriben bundles existentes.
- Cada bundle contiene hashes SHA‑256 y conteos de todas las tablas de aplicación en ambas bases.
- La verificación rechaza manifests vacíos, encabezados inválidos, tablas duplicadas o cobertura distinta a las tablas realmente restauradas.
- La verificación restaura en un contenedor PostgreSQL 18 temporal sin puertos ni volúmenes RHIA.
- Los servicios activos no se reinician.
- El backup completo y su passphrase están excluidos del repositorio por política.

## Archivos

- `scripts/backup-postgres.sh`: crea el bundle cifrado.
- `scripts/verify-postgres-backup.sh`: valida hashes, restore y conteos.

## Bundle esperado

```text
rhia-postgres-YYYYMMDDTHHMMSSZ/
├── rhia_core.dump.gpg
├── n8n.dump.gpg
├── counts.tsv
├── metadata.txt
└── SHA256SUMS
```

Todos los archivos se crean con permisos restringidos. Los dumps contienen datos reales cifrados y deben permanecer fuera de Git, sincronizaciones públicas y carpetas compartidas.

## Procedimiento propuesto

1. Elegir un directorio persistente fuera del repositorio, preferiblemente en una unidad distinta o destino de backup aprobado.
2. Crear fuera del repositorio un archivo de passphrase fuerte y aplicar `chmod 600`.
3. Ejecutar desde Ubuntu WSL:

   ```bash
   RHIA_BACKUP_PASSPHRASE_FILE=/ruta/segura/passphrase \
     bash "/mnt/c/Users/jesfu/Desktop/Software RHIA/scripts/backup-postgres.sh" \
     /ruta/segura/backups-rhia
   ```

4. Ejecutar inmediatamente la verificación sobre el bundle generado:

   ```bash
   RHIA_BACKUP_PASSPHRASE_FILE=/ruta/segura/passphrase \
     bash "/mnt/c/Users/jesfu/Desktop/Software RHIA/scripts/verify-postgres-backup.sh" \
     /ruta/segura/backups-rhia/rhia-postgres-YYYYMMDDTHHMMSSZ
   ```

5. Registrar hash, fecha, tamaño, cantidad de tablas y resultado del restore en `docs/baseline/database.md`.
6. Conservar inicialmente los 7 bundles válidos más recientes. La eliminación automática no se habilita en PH01.
7. Agregar una segunda copia física o remota aprobada antes de cerrar el trabajo de disaster recovery de `PH10-T004`.

## Ejecución aprobada

- Fecha: 2026-08-20 14:53 UTC-05:00.
- Destino: `%USERPROFILE%\RHIA-Backups`.
- Bundle: `rhia-postgres-20260820T195344Z`.
- Passphrase: `%USERPROFILE%\.rhia-secrets\backup-passphrase`, protegida mediante ACL de Windows y fuera del repositorio.
- Retención inicial: 7 bundles válidos; no se eliminó ningún backup en esta sesión.
- Resultado: hashes correctos, restore aislado completo y conteos idénticos para 133/133 tablas.

`PH01-T002` queda completada. La segunda copia independiente, el RPO/RTO, la programación y la poda automática pertenecen a `PH10-T004`.
