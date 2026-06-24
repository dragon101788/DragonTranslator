param(
    [ValidateSet("patch","minor","major")]
    [string]$Bump = "patch"
)

$ErrorActionPreference = "Stop"
$cargo = "src-tauri\Cargo.toml"
$tauri = "src-tauri\tauri.conf.json"

# 1. Read current version
$cur = (Select-String -Path $cargo -Pattern '^version\s*=\s*"(.*)"').Matches.Groups[1].Value
Write-Host "Current version: $cur"

# 2. Bump
$v = $cur -split '\.'
switch ($Bump) {
    "major" { $v[0] = [int]$v[0] + 1; $v[1] = 0; $v[2] = 0 }
    "minor" { $v[1] = [int]$v[1] + 1; $v[2] = 0 }
    "patch" { $v[2] = [int]$v[2] + 1 }
}
$new = "$($v[0]).$($v[1]).$($v[2])"
Write-Host "New version: $new"

# 3. Write version to Cargo.toml and tauri.conf.json
(Get-Content $cargo -Raw) -replace 'version\s*=\s*"[^"]*"', "version = `"$new`"" | Set-Content $cargo -NoNewline
(Get-Content $tauri -Raw) -replace '"version"\s*:\s*"[^"]*"', "`"version`": `"$new`"" | Set-Content $tauri -NoNewline
Write-Host "Version files updated"

# 4. Check ZIP freshness
$exe = "src-tauri\target\release\龙腾翻译.exe"
$zip = "DragonTranslator.zip"
$needRebuild = -not (Test-Path $zip)
if (-not $needRebuild -and (Test-Path $exe)) {
    $exeTime = (Get-Item $exe).LastWriteTime
    $zipTime = (Get-Item $zip).LastWriteTime
    $needRebuild = $exeTime -gt $zipTime
}
if ($needRebuild) {
    Write-Host "ZIP stale/missing, rebuilding..."
    & ".\打包.bat" "silent"
}

# 5. Git: commit version bump + tag + push
Write-Host "Tagging v$new..."
git add $cargo $tauri
git commit -m "chore: bump version to $new"
git tag -a "v$new" -m "v$new"
git push origin "v$new"
git push origin master
Write-Host ">>> Release v$new pushed"
