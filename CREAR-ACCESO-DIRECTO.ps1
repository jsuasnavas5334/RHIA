# RHIA - Crear Acceso Directo en Inicio
# Script PowerShell - Sin requiere escaping de comillas

Write-Host ""
Write-Host "=============================================="
Write-Host "RHIA - Crear Acceso Directo en Inicio"
Write-Host "=============================================="
Write-Host ""

# Get the Startup folder path
$STARTUP_FOLDER = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"

Write-Host "Carpeta de Inicio: $STARTUP_FOLDER"
Write-Host ""

# Check if startup folder exists
if (-not (Test-Path $STARTUP_FOLDER)) {
    Write-Host "ERROR: Carpeta de Inicio no encontrada"
    Read-Host "Presione Enter para salir"
    exit 1
}

Write-Host "Creando acceso directo para RHIA-Boot..."
Write-Host ""

try {
    # Create the shortcut using WScript.Shell COM object
    $WshShell = New-Object -ComObject WScript.Shell
    $ShortcutPath = Join-Path $STARTUP_FOLDER "RHIA-Boot.lnk"
    $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
    
    # Configure the shortcut
    $Shortcut.TargetPath = "powershell.exe"
    $Shortcut.Arguments = "-ExecutionPolicy Bypass -File C:\Users\jesfu\Desktop\SOFTWA~1\scripts\rhia-boot.ps1"
    $Shortcut.WorkingDirectory = "C:\Users\jesfu\Desktop\Software RHIA"
    $Shortcut.WindowStyle = 0  # Hidden window
    
    # Save the shortcut
    $Shortcut.Save()
    
    Write-Host ""
    Write-Host "=============================================="
    Write-Host "EXITO - Acceso directo creado"
    Write-Host "=============================================="
    Write-Host ""
    Write-Host "El acceso directo RHIA-Boot.lnk ha sido creado en:"
    Write-Host $STARTUP_FOLDER
    Write-Host ""
    Write-Host "Que pasara:"
    Write-Host "- Cada vez que inicies sesion, RHIA-Boot se ejecutara automaticamente"
    Write-Host "- Tus servicios Docker se iniciaran sin necesidad de hacer nada"
    Write-Host ""
    Write-Host "NO se requieren permisos de administrador"
    Write-Host "NO aparecera dialogo de UAC"
    Write-Host ""
    Write-Host "Simplemente reinicia Windows para probar!"
    
} catch {
    Write-Host ""
    Write-Host "ERROR - No se pudo crear el acceso directo"
    Write-Host "Detalle del error: $_"
}

Write-Host ""
Write-Host "=============================================="
Write-Host ""
Read-Host "Presione Enter para salir"
