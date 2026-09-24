' VBScript to execute the deployment automation script
Set objShell = CreateObject("WScript.Shell")
strPath = "C:\Users\jesfu\Desktop\Software RHIA"
strBatch = strPath & "\execute-deployment-no-pause.bat"

' Execute the batch file
Set objExec = objShell.Exec(strBatch)

' Wait for it to complete
Do While Not objExec.Status
    WScript.Sleep 100
Loop

' Show completion message
MsgBox "Deployment automation completed!", 0, "RHIA Deployment"
