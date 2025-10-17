#!/usr/bin/env pwsh
# Fix Cognito callback URLs for Convex Auth

param(
    [string]$UserPoolId = "us-east-1_hMFTc7CNL",
    [string]$ClientId = "fk09hmkpbk7sral3cj9ofh5vc",
    [string]$Region = "us-east-1",
    [string]$ProductionUrl = "https://ai-forge.mikepfunk.com",
    [string]$ConvexSiteUrl = "https://resolute-kudu-325.convex.site"
)

Write-Host "🔧 Fixing Cognito Callback URLs for Convex Auth..." -ForegroundColor Cyan
Write-Host ""

# Define the correct callback URLs for Convex Auth
$callbackUrls = @(
    "$ProductionUrl/api/auth/callback/cognito",
    "$ConvexSiteUrl/api/auth/callback/cognito"
)

$logoutUrls = @(
    "$ProductionUrl",
    "$ConvexSiteUrl"
)

Write-Host "New Callback URLs:" -ForegroundColor Yellow
foreach ($url in $callbackUrls) {
    Write-Host "  - $url" -ForegroundColor White
}
Write-Host ""

Write-Host "New Logout URLs:" -ForegroundColor Yellow
foreach ($url in $logoutUrls) {
    Write-Host "  - $url" -ForegroundColor White
}
Write-Host ""

try {
    # Get current client configuration
    $currentConfig = aws cognito-idp describe-user-pool-client `
        --user-pool-id $UserPoolId `
        --client-id $ClientId `
        --region $Region `
        --output json | ConvertFrom-Json

    $client = $currentConfig.UserPoolClient

    # Update the app client with correct callback URLs
    Write-Host "Updating Cognito app client..." -ForegroundColor Cyan
    
    $updateParams = @(
        "--user-pool-id", $UserPoolId,
        "--client-id", $ClientId,
        "--region", $Region,
        "--client-name", $client.ClientName,
        "--allowed-o-auth-flows", "code",
        "--allowed-o-auth-scopes", "openid", "profile", "email",
        "--allowed-o-auth-flows-user-pool-client",
        "--callback-urls"
    )
    
    # Add each callback URL
    foreach ($url in $callbackUrls) {
        $updateParams += $url
    }
    
    # Add logout URLs
    $updateParams += "--logout-urls"
    foreach ($url in $logoutUrls) {
        $updateParams += $url
    }
    
    # Add supported identity providers
    $updateParams += "--supported-identity-providers", "COGNITO"

    aws cognito-idp update-user-pool-client @updateParams

    Write-Host ""
    Write-Host "✅ Successfully updated Cognito callback URLs!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Verifying changes..." -ForegroundColor Cyan
    
    # Verify the changes
    & "$PSScriptRoot\check-cognito-config.ps1" -UserPoolId $UserPoolId -ClientId $ClientId -Region $Region

} catch {
    Write-Host "❌ Error updating Cognito configuration:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
