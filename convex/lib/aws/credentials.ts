/**
 * AWS Credential Validation
 * Canonical implementation — import from here, do not redefine.
 */

/**
 * Validate that AWS credentials are consistently configured.
 * Both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set together or both unset.
 * Returns the credentials if valid, or null if both are unset.
 * Throws if only one is set (misconfiguration).
 */
export function validateAwsCredentials(): { accessKeyId: string; secretAccessKey: string } | null {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (accessKeyId && secretAccessKey) {
    return { accessKeyId, secretAccessKey };
  }

  if (!accessKeyId && !secretAccessKey) {
    return null;
  }

  throw new Error(
    "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must both be set or both be unset"
  );
}

/**
 * Require AWS credentials — throws if not configured.
 * Use this when AWS credentials are mandatory (e.g., Bedrock calls, S3 uploads).
 */
export function requireAwsCredentials(): { accessKeyId: string; secretAccessKey: string } {
  const creds = validateAwsCredentials();
  if (!creds) {
    throw new Error(
      "Missing AWS credentials: ensure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set in the environment"
    );
  }
  return creds;
}
