' Alternative VBScript to run Task Scheduler registration as Administrator
' Can also be run with right-click > Run as Administrator

Set objShell = CreateObject("WScript.Shell")
Dim objWshScriptExec

' Run PowerShell with admin privileges
strCommand = "powershell.exe -ExecutionPolicy Bypass -NoExit -Command ""cd 'C:\Users\jesfu\Desktop\Software RHIA'; & '.\scripts\rhia-register-startup-task.ps1'"""

On Error Resume Next
Set objWshScriptExec = objShell.Exec("powershell.exe -Command ""Start-Process powershell.exe -ArgumentList '-ExecutionPolicy Bypass -NoExit -Command """"cd \'C:\Users\jesfu\Desktop\Software RHIA\'; & \'.\scripts\rhia-register-startup-task.ps1\'""""' -Verb RunAs -Wait""")

If Err.Number <> 0 Then
    MsgBox "No se pudo ejecutar con privilegios de administrador. Por favor ejecuta con clic derecho > Ejecutar como administrador", 48, "Error"
Else
    MsgBox "Tarea registrada exitosamente en Windows Task Scheduler!", 64, "Éxito"
End If
