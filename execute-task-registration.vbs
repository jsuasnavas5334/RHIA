' VBScript to execute direct task registration - no UAC elevation needed
' schtasks.exe can run in user context

Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Change to RHIA directory
strPath = "C:\Users\jesfu\Desktop\Software RHIA"
strScript = strPath & "\register-task-direct.ps1"
strLogFile = strPath & "\task-registration.log"

' Execute PowerShell script directly (no elevation needed for user context)
strCommand = "powershell.exe -ExecutionPolicy Bypass -NoExit -File """ & strScript & """ > """ & strLogFile & """ 2>&1"

On Error Resume Next

' Execute without elevation - schtasks.exe runs in user context
Set objExec = objShell.Exec(strCommand)

' Wait for completion
Do While Not objExec.Status
    WScript.Sleep 500
Loop

' Read and display results
If objFSO.FileExists(strLogFile) Then
    Set objFile = objFSO.OpenTextFile(strLogFile, 1)
    strOutput = objFile.ReadAll()
    objFile.Close()
    
    If InStr(strOutput, "ÉXITO") > 0 Or InStr(strOutput, "EXITO") > 0 Then
        MsgBox "✅ Tarea registrada exitosamente en Windows Task Scheduler!" & vbCrLf & vbCrLf & strOutput, 64, "RHIA - Éxito"
    Else
        MsgBox "Resultado:" & vbCrLf & strOutput, 0, "RHIA - Registro de Tarea"
    End If
Else
    MsgBox "Tarea ejecutada pero no se encontró log.", 48, "Advertencia"
End If
