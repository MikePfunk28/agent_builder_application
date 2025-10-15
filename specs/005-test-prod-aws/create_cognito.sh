#!/bin/bash

REGION=$(aws configure get region)

# Create user pool
USER_POOL_ID=$(aws cognito-idp create-user-pool \
  --pool-name AgentCoreIdentityQuickStartPool \
  --query 'UserPool.Id' \
  --no-cli-pager \
  --output text)

# Create user pool domain
DOMAIN_NAME="agentcore-quickstart-$(LC_ALL=C tr -dc 'a-z0-9' < /dev/urandom | head -c 5)"
aws cognito-idp create-user-pool-domain \
  --domain $DOMAIN_NAME \
  --no-cli-pager \
  --user-pool-id $USER_POOL_ID > /dev/null

# Create user pool client with secret and hosted UI settings
CLIENT_RESPONSE=$(aws cognito-idp create-user-pool-client \
  --user-pool-id $USER_POOL_ID \
  --client-name AgentCoreQuickStart \
  --generate-secret \
  --callback-urls "https://bedrock-agentcore.$REGION.amazonaws.com/identities/oauth2/callback" \
  --allowed-o-auth-flows "code" \
  --allowed-o-auth-scopes "openid" "profile" "email" \
  --allowed-o-auth-flows-user-pool-client \
  --supported-identity-providers "COGNITO" \
  --query 'UserPoolClient.{ClientId:ClientId,ClientSecret:ClientSecret}' \
  --output json)

CLIENT_ID=$(echo $CLIENT_RESPONSE | jq -r '.ClientId')
CLIENT_SECRET=$(echo $CLIENT_RESPONSE | jq -r '.ClientSecret')

# Generate random username and password
USERNAME="AgentCoreTestUser$(printf "%04d" $((RANDOM % 10000)))"
PASSWORD="$(LC_ALL=C tr -dc 'A-Za-z0-9!@#$%^&*()_+-=[]{}|;:,.<>?' < /dev/urandom | head -c 16)"

# Create user with permanent password
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username $USERNAME \
  --output text > /dev/null

aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username $USERNAME \
  --password $PASSWORD \
  --output text > /dev/null \
  --permanent

# Get region

ISSUER_URL="https://cognito-idp.$REGION.amazonaws.com/$USER_POOL_ID/.well-known/openid-configuration"
HOSTED_UI_URL="https://$DOMAIN_NAME.auth.$REGION.amazoncognito.com"

# Output results
echo "User Pool ID: $USER_POOL_ID"
echo "Client ID: $CLIENT_ID"
echo "Client Secret: $CLIENT_SECRET"
echo "Issuer URL: $ISSUER_URL"
echo "Hosted UI URL: $HOSTED_UI_URL"
echo "Test User: $USERNAME"
echo "Test Password: $PASSWORD"

echo ""
echo "# Copy and paste these exports to set environment variables for later use:"
echo "export USER_POOL_ID='$USER_POOL_ID'"
echo "export CLIENT_ID='$CLIENT_ID'"
echo "export CLIENT_SECRET='$CLIENT_SECRET'"
echo "export ISSUER_URL='$ISSUER_URL'"
echo "export HOSTED_UI_URL='$HOSTED_UI_URL'"
echo "export COGNITO_USERNAME='$USERNAME'"
echo "export COGNITO_PASSWORD='$PASSWORD'"