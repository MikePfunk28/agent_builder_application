cat > setup_cognito.py << 'EOF'
import boto3
import json

def create_cognito_setup():
    cognito = boto3.client('cognito-idp')
    
    # Create User Pool
    user_pool = cognito.create_user_pool(
        PoolName='AgentCoreTestPool',
        Policies={
            'PasswordPolicy': {
                'MinimumLength': 8,
                'RequireUppercase': False,
                'RequireLowercase': False,
                'RequireNumbers': False,
                'RequireSymbols': False
            }
        },
        AutoVerifiedAttributes=['email'],
        UsernameAttributes=['email']
    )
    
    user_pool_id = user_pool['UserPool']['Id']
    print(f"Created User Pool: {user_pool_id}")
    
    # Create User Pool Client
    client = cognito.create_user_pool_client(
        UserPoolId=user_pool_id,
        ClientName='AgentCoreTestClient',
        GenerateSecret=True,
        SupportedIdentityProviders=['COGNITO'],
        CallbackURLs=['http://localhost:8080/callback'],
        AllowedOAuthFlows=['authorization_code'],
        AllowedOAuthScopes=['openid', 'email', 'profile'],
        AllowedOAuthFlowsUserPoolClient=True
    )
    
    client_id = client['UserPoolClient']['ClientId']
    client_secret = client['UserPoolClient']['ClientSecret']
    
    print(f"Created Client: {client_id}")
    
    # Create test user
    try:
        cognito.admin_create_user(
            UserPoolId=user_pool_id,
            Username='testuser@example.com',
            TemporaryPassword='TempPass123!',
            MessageAction='SUPPRESS'
        )
        
        # Set permanent password
        cognito.admin_set_user_password(
            UserPoolId=user_pool_id,
            Username='testuser@example.com',
            Password='TestPass123!',
            Permanent=True
        )
        print("Created test user: testuser@example.com / TestPass123!")
    except Exception as e:
        print(f"User creation note: {e}")
    
    # Get User Pool Domain
    region = boto3.Session().region_name
    domain = f"https://cognito-idp.{region}.amazonaws.com/{user_pool_id}"
    
    config = {
        'user_pool_id': user_pool_id,
        'client_id': client_id,
        'client_secret': client_secret,
        'domain': domain,
        'region': region
    }
    
    with open('cognito_config.json', 'w') as f:
        json.dump(config, f, indent=2)
    
    print("\nCognito setup complete! Config saved to cognito_config.json")
    return config

if __name__ == "__main__":
    create_cognito_setup()
EOF
