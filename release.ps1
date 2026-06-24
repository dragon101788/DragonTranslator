param(
    [ValidateSet("patch","minor","major")]
    [string]$Bump = "patch"
)

$ErrorActionPreference = "Stop"
$cargo = "src-tauri\Cargo.toml"
$tauri = "src-tauri\tauri.conf.json"

# 1. Fetch latest tags from remote and find highest version
Write-Host "Fetching remote tags..."
git fetch --tags 2>&1 | Out-Null
$latest = git tag -l "v*" | ForEach-Object { $_ -replace '^v', '' } | Sort-Object { [Version]$_ } | Select-Object -Last 1
if (-not $latest) {
    Write-Host "ERROR: No existing version tags found on remote"
    exit 1
}
Write-Host "Latest remote version: $latest"

# 2. Bump from remote version
$v = $latest -split '\.'
switch ($Bump) {
    "major" { $v[0] = [int]$v[0] + 1; $v[1] = 0; $v[2] = 0 }
    "minor" { $v[1] = [int]$v[1] + 1; $v[2] = 0 }
    "patch" { $v[2] = [int]$v[2] + 1 }
}
$new = "$($v[0]).$($v[1]).$($v[2])"
Write-Host "New version: $new (bump $Bump from $latest)"

# 3. Write version to Cargo.toml and tauri.conf.json
# (?m) = multiline mode so ^ matches line start (only package-level version, not dep versions)
(Get-Content $cargo -Raw) -replace '(?m)^version\s*=\s*"[^"]*"', "version = `"$new`"" | Set-Content $cargo -NoNewline
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

# 5. Check tag doesn't already exist
$existing = git tag -l "v$new"
if ($existing) {
    Write-Host "ERROR: Tag v$new already exists!"
    Write-Host "If this was a mistake, delete the tag: git tag -d v$new; git push origin :refs/tags/v$new"
    exit 1
}

# 6. Git: commit version bump + tag + push
Write-Host "Committing..."
git add $cargo $tauri
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: git add failed"; exit 1 }
git commit -m "chore: bump version to $new"
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: git commit failed (nothing to commit?)"; exit 1 }

Write-Host "Pushing tag v$new..."
git push origin "v$new"
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: git push tag failed"; exit 1 }
Write-Host "Pushing master..."
git push origin master
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: git push master failed"; exit 1 }

Write-Host "=== Git push OK ==="

# 7. Create GitHub Release (requires gh CLI authenticated)
$repo = "dragon101788/DragonTranslator"
Write-Host "Creating GitHub Release..."
$result = gh release create "v$new" "$zip" --repo $repo --title "v$new" --notes "Release v$new" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "=== Release v$new published ==="
    Write-Host $result
} else {
    Write-Host "WARNING: gh release create failed (not authenticated?)"
    Write-Host "Tag v$new is pushed. Create Release manually:"
    Write-Host "  https://github.com/$repo/releases/new?tag=v$new"
    Start-Process "https://github.com/$repo/releases/new?tag=v$new"
}
