$params = @{
    HtmlBodyContent = "Testing JavaScript and CSS paths..."
    JavaScriptPaths = ".\Assets\script.js"
    StyleSheetPaths = ".\Assets\style.css"
}

$view = New-VSCodeHtmlContentView -Title "Test View 2" -ShowInColumn Two
Set-VSCodeHtmlContentView -View $view @params

Get-Process | % { "Process: $($_.Name)<br />" } | Write-VSCodeHtmlContentView -View $view