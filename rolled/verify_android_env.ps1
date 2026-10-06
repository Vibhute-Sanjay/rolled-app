# Android Environment Verification Script
Write-Host "Starting Android Environment Check..." -ForegroundColor Cyan
Write-Host "----------------------------------------"

# 1. Check JAVA
Write-Host "1. Checking Java (JDK)..." -ForegroundColor Yellow
try {
    $javaVer = java -version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   OK: Java is installed." -ForegroundColor Green
    } else {
        Write-Host "   ERROR: Java command failed to run." -ForegroundColor Red
    }
} catch {
    Write-Host "   ERROR: Java not found in PATH." -ForegroundColor Red
}

# 2. Check JAVA_HOME
Write-Host ""
Write-Host "2. Checking JAVA_HOME..." -ForegroundColor Yellow
if ($env:JAVA_HOME) {
    if (Test-Path $env:JAVA_HOME) {
        Write-Host "   OK: JAVA_HOME is set to: $env:JAVA_HOME" -ForegroundColor Green
    } else {
        Write-Host "   ERROR: JAVA_HOME is set but path does not exist: $env:JAVA_HOME" -ForegroundColor Red
    }
} else {
    Write-Host "   ERROR: JAVA_HOME is NOT set." -ForegroundColor Red
}

# 3. Check ANDROID_HOME
Write-Host ""
Write-Host "3. Checking ANDROID_HOME..." -ForegroundColor Yellow
if ($env:ANDROID_HOME) {
    if (Test-Path $env:ANDROID_HOME) {
        Write-Host "   OK: ANDROID_HOME is set to: $env:ANDROID_HOME" -ForegroundColor Green
    } else {
        Write-Host "   ERROR: ANDROID_HOME is set but path does not exist: $env:ANDROID_HOME" -ForegroundColor Red
    }
} else {
    Write-Host "   ERROR: ANDROID_HOME is NOT set (Required for Gradle)." -ForegroundColor Red
}

# 4. Check local.properties
Write-Host ""
Write-Host "4. Checking android/local.properties..." -ForegroundColor Yellow
$localPropPath = "android\local.properties"
if (Test-Path $localPropPath) {
    Write-Host "   OK: local.properties exists." -ForegroundColor Green
    $content = Get-Content $localPropPath
    foreach ($line in $content) {
        Write-Host "      $line" -ForegroundColor Gray
    }
} else {
    Write-Host "   WARNING: local.properties is MISSING." -ForegroundColor Yellow
    if ($env:ANDROID_HOME) {
        Write-Host "   ACTION: Attempting to create it from ANDROID_HOME..."
        $sdkPath = $env:ANDROID_HOME.Replace("\", "\\")
        "sdk.dir=$sdkPath" | Out-File $localPropPath -Encoding ascii
        Write-Host "   OK: Created android/local.properties" -ForegroundColor Green
    } else {
        Write-Host "   ERROR: Cannot create local.properties because ANDROID_HOME is missing." -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "----------------------------------------"
Write-Host "Check Finished." -ForegroundColor Cyan
