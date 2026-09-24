' VBScript to execute PowerShell deployment script with logging

Set objShell = CreateObject("WScript.Shell")

' Execute PowerShell script with ExecutionPolicy Bypass
strCommand = "powershell.exe -ExecutionPolicy Bypass -File ""C:\Users\jesfu\Desktop\Software RHIA\run-deployment-with-log.ps1"""

'Execute with window hidden
Set objExec = objShell.Exec(strCommand)

' Wait for completion
objExec.StdOut.ReadAll()
Do While Not objExec.Status
    WScript.Sleep 100
Loop

' Read the log file and display
Set objFSO = CreateObject("Scripting.FileSystemObject")
logFile = "C:\Users\jesfu\Desktop\Software RHIA\deployment-execution.log"

If objFSO.FileExists(logFile) Then
    Set objLogFile = objFSO.OpenTextFile(logFile, 1)
    logContent = objLogFile.ReadAll()
    objLogFile.Close()
    MsgBox "Deployment completed!" & vbCrLf & vbCrLf & logContent, 0, "RHIA Deployment Status"
Else
    MsgBox "Deployment executed but log file not found!", 48, "Warning"
End If
