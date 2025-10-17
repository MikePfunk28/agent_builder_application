#!/usr/bin/env pwsh
# Check current Cognito configuration

param(
    [string]$UserPoolId = "us-east-1_hMFTc7CNL",
    [string]$ClientId = "fk09hmkpbk7sral3cj9ofh5vc",
    [string]$Region = "us-east-1"
)

Write-Host "🔍 Checking Cognito Configuration..." -ForegroundColor Cyan
Write-Host "User Pool ID: $UserPoolId" -ForegroundColor Gray
Write-Host "Client ID: $ClientId" -ForegroundColor Gray
Write-Host ""

try {
    # Get the app client configuration
    $clientConfig = aws cognito-idp describe-user-pool-client `
        --user-pool-id $UserPoolId `
        --client-id $ClientId `
        --region $Region `
        --output json | ConvertFrom-Json

    Write-Host "✅ Current Cognito App Client Configuration:" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "Client Name: $($clientConfig.UserPoolClient.ClientName)" -ForegroundColor White
    Write-Host ""
    
    Write-Host "Callback URLs:" -ForegroundColor Yellow
    if ($clientConfig.UserPoolClient.CallbackURLs) {
        foreach ($url in $clientConfig.UserPoolClient.CallbackURLs) {
            Write-Host "  - $url" -ForegroundColor White
        }
    } else {
        Write-Host "  (none configured)" -ForegroundColor Red
    }
    Write-Host ""
    
    Write-Host "Logout URLs:" -ForegroundColor Yellow
    if ($clientConfig.UserPoolClient.LogoutURLs) {
        foreach ($url in $clientConfig.UserPoolClient.LogoutURLs) {
            Write-Host "  - $url" -ForegroundColor White
        }
    } else {
        Write-Host "  (none configured)" -ForegroundColor Red
    }
    Write-Host ""
    
    Write-Host "Allowed OAuth Flows:" -ForegroundColor Yellow
    if ($clientConfig.UserPoolClient.AllowedOAuthFlows) {
        foreach ($flow in $clientConfig.UserPoolClient.AllowedOAuthFlows) {
            Write-Host "  - $flow" -ForegroundColor White
        }
    } else {
        Write-Host "  (none configured)" -ForegroundColor Red
    }
    Write-Host ""
    
    Write-Host "Allowed OAuth Scopes:" -ForegroundColor Yellow
    if ($clientConfig.UserPoolClient.AllowedOAuthScopes) {
        foreach ($scope in $clientConfig.UserPoolClient.AllowedOAuthScopes) {
            Write-Host "  - $scope" -ForegroundColor White
        }
    } else {
        Write-Host "  (none configured)" -ForegroundColor Red
    }
    Write-Host ""

} catch {
    Write-Host "❌ Error checking Cognito configuration:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
