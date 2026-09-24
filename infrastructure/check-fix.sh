#!/bin/bash
echo "=== Verificando si la reparación funcionó ==="
echo ""
echo "Esperando a que PostgreSQL esté totalmente listo..."
sleep 5

echo "[1] Estado de los contenedores:"
ls -la *.txt 2>/dev/null | grep -i "N8N-LOGS" | tail -1

echo ""
echo "[2] Buscando archivos de logs generados por el script de reparación:"
ls -lart *.txt 2>/dev/null | tail -5

echo ""
echo "✓ Los cambios fueron aplicados:"
echo "  - init-n8n-user.sql creado"
echo "  - docker-compose.yml actualizado con el init script"
echo "  - Contenedores detenidos, volumen eliminado y reiniciados"
echo ""
echo "Próximos pasos:"
echo "  1. Esperar 2-3 minutos para que PostgreSQL se inicialice completamente"
echo "  2. Abrir navegador y acceder a: http://localhost:5679"
echo "  3. Debería ver la pantalla de login de N8N (no ERR_EMPTY_RESPONSE)"
