$stage = "release_stage/DragonPro_v1.9.9"
if (Test-Path $stage) { 
    Remove-Item -Recurse -Force $stage 
}
New-Item -ItemType Directory -Path "$stage/components" -Force | Out-Null
New-Item -ItemType Directory -Path "$stage/assets" -Force | Out-Null
New-Item -ItemType Directory -Path "$stage/dist/assets" -Force | Out-Null

# Root files
Copy-Item "version.json" "$stage/"
Copy-Item "update-config.json" "$stage/"
Copy-Item "package.json" "$stage/"
Copy-Item "CHANGELOG.md" "$stage/"
Copy-Item "App.tsx" "$stage/"
Copy-Item "constants.tsx" "$stage/"

# Modified components
$modifiedComponents = @(
    "AdminModule.tsx",
    "Layout.tsx",
    "PrintTemplates.tsx",
    "PrintableOrderCard.tsx",
    "RepresentativesModule.tsx",
    "SalesDaily.tsx",
    "SalesUpdateStatus.tsx",
    "UniversalWaybillRenderer.tsx",
    "WaybillBuilder.tsx",
    "WaybillBuilderAdvanced.tsx",
    "WaybillBuilderQuick.tsx",
    "WaybillTemplatesManager.tsx"
)

foreach ($c in $modifiedComponents) {
    Copy-Item "components/$c" "$stage/components/"
}

# Production compiled files
Copy-Item "dist/index.html" "$stage/dist/"
Copy-Item "dist/assets/*" "$stage/dist/assets/"
Copy-Item "dist/index.html" "$stage/index.html"
Copy-Item "dist/assets/*" "$stage/assets/"

# Create zip in releases
if (-not (Test-Path "releases")) { 
    New-Item -ItemType Directory -Path "releases" | Out-Null 
}
$zipPath = "releases/DragonPro_v1.9.9.zip"
if (Test-Path $zipPath) { 
    Remove-Item -Force $zipPath 
}
Compress-Archive -Path "$stage/*" -DestinationPath $zipPath -Force

$item = Get-Item $zipPath
Write-Host "Created release zip: $($item.FullName) ($([math]::Round($item.Length/1KB, 2)) KB)"
