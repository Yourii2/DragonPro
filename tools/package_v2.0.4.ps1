$version = '2.0.4'
$stage = "release_stage/DragonPro_$version"
if (Test-Path 'release_stage') { 
    Remove-Item -Recurse -Force 'release_stage' 
}

New-Item -ItemType Directory -Path "$stage" -Force | Out-Null
New-Item -ItemType Directory -Path "$stage/components" -Force | Out-Null
New-Item -ItemType Directory -Path "$stage/assets" -Force | Out-Null
New-Item -ItemType Directory -Path "$stage/dist" -Force | Out-Null
New-Item -ItemType Directory -Path "$stage/dist/assets" -Force | Out-Null

# 1. Root files
Copy-Item 'version.json' "$stage/"
Copy-Item 'package.json' "$stage/"
Copy-Item 'update-config.json' "$stage/"
Copy-Item 'vite.config.ts' "$stage/"
if (Test-Path 'tunnel.json') { Copy-Item 'tunnel.json' "$stage/" }
Copy-Item 'start.bat' "$stage/"
Copy-Item 'start_new.bat' "$stage/"
Copy-Item 'restart.bat' "$stage/"
Copy-Item 'update_and_restart.bat' "$stage/"

# 2. Production compiled files
Copy-Item 'dist/index.html' "$stage/index.html"
Copy-Item 'dist/assets/*' "$stage/assets/"
Copy-Item 'dist/index.html' "$stage/dist/index.html"
Copy-Item 'dist/assets/*' "$stage/dist/assets/"

# 3. Components
Copy-Item -Recurse 'components/*' "$stage/components/"

# Clean up temp and log files from components
Get-ChildItem -Path "$stage/components" -Include *.tmp, *.bak, *.log -Recurse | Remove-Item -Force

# 4. Migrations & Tools
if (Test-Path 'migrations') { 
    Copy-Item -Recurse 'migrations' "$stage/" 
}
if (Test-Path 'tools') { 
    Copy-Item -Recurse 'tools' "$stage/" 
}

# 5. Output zip
if (-not (Test-Path 'releases')) { 
    New-Item -ItemType Directory -Path 'releases' | Out-Null 
}
$zipPath = "releases/DragonPro_v$version.zip"
if (Test-Path $zipPath) { 
    Remove-Item -Force $zipPath 
}

Compress-Archive -Path "$stage/*" -DestinationPath $zipPath -Force
Remove-Item -Recurse -Force 'release_stage'

$item = Get-Item $zipPath
$mb = [math]::Round($item.Length / 1MB, 2)
Write-Host "SUCCESS: Created $zipPath ($mb MB)"
