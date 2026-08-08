$HarnessDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Target = Join-Path $env:USERPROFILE ".claude"

New-Item -ItemType Directory -Force -Path $Target | Out-Null

foreach ($dir in @("skills", "hooks", "rules", "commands", "agents", "mcp-configs")) {
    $linkPath = Join-Path $Target $dir
    if (Test-Path $linkPath) {
        Remove-Item $linkPath -Recurse -Force
    }
    New-Item -ItemType SymbolicLink -Path $linkPath -Target (Join-Path $HarnessDir $dir) | Out-Null
    Write-Host "Linked $dir -> $linkPath"
}

Write-Host "Installed my-harness at user level ($Target)."
