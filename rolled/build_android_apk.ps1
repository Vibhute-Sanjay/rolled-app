# Build Android APK Locally
Write-Host "🚀 Starting Local Android Build..." -ForegroundColor Green

# Ensure we are in the right directory
Set-Location "c:\Users\sanja\Desktop\rolledorg\rolled"

# Run the local build command
# --local: Tells EAS to use your machine's resources instead of the cloud
# --profile preview: Uses the configuration for APK generation
eas build -p android --profile preview --local

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build Process Finished! Check the output above for the APK location." -ForegroundColor Green
} else {
    Write-Host "❌ Build Failed." -ForegroundColor Red
}
