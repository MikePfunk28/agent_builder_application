// AWS S3 client wrapper for deployment packages and build contexts
// Note: AWS SDK imports are done dynamically in actions to avoid Convex environment issues

// Get AWS credentials from environment
const AWS_REGION = process.env.AWS_S3_REGION || "us-east-1";
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const DEPLOYMENT_BUCKET = process.env.AWS_S3_DEPLOYMENT_BUCKET || "";

// Create S3 client dynamically to avoid Convex environment issues
async function createS3Client() {
  const { S3Client } = await import("@aws-sdk/client-s3");
  
  return new S3Client({
    region: AWS_REGION,
    credentials: AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: AWS_ACCESS_KEY_ID,
          secretAccessKey: AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
  });
}

/**
 * Upload a file to S3
 */
export async function uploadToS3(params: {
  bucket?: string;
  key: string;
  body: string | Buffer;
  contentType?: string;
}): Promise<{ bucket: string; key: string; url: string }> {
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const s3Client = await createS3Client();
  
  const bucket = params.bucket || DEPLOYMENT_BUCKET;

  if (!bucket) {
    throw new Error("Missing S3 bucket configuration. Set AWS_S3_DEPLOYMENT_BUCKET environment variable.");
  }

  const putCommand = {
    Bucket: bucket,
    Key: params.key,
    Body: params.body,
    ContentType: params.contentType || "application/octet-stream",
  };

  const command = new PutObjectCommand(putCommand);
  await s3Client.send(command);

  const url = `https://${bucket}.s3.${AWS_REGION}.amazonaws.com/${params.key}`;

  return { bucket, key: params.key, url };
}

/**
 * Generate a pre-signed download URL
 */
export async function generatePreSignedUrl(params: {
  bucket?: string;
  key: string;
  expiresIn?: number; // seconds, default 24 hours
}): Promise<string> {
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const s3Client = await createS3Client();
  
  const bucket = params.bucket || DEPLOYMENT_BUCKET;
  const expiresIn = params.expiresIn || 86400; // 24 hours

  if (!bucket) {
    throw new Error("Missing S3 bucket configuration");
  }

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: params.key,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn });
  return url;
}

/**
 * Delete a file from S3
 */
export async function deleteFromS3(params: {
  bucket?: string;
  key: string;
}): Promise<void> {
  const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  const s3Client = await createS3Client();
  
  const bucket = params.bucket || DEPLOYMENT_BUCKET;

  if (!bucket) {
    throw new Error("Missing S3 bucket configuration");
  }

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: params.key,
  });

  await s3Client.send(command);
}

/**
 * Upload deployment package ZIP to S3
 */
export async function uploadDeploymentPackage(params: {
  packageName: string;
  zipBuffer: Buffer;
}): Promise<{ s3Key: string; downloadUrl: string }> {
  const s3Key = `packages/${params.packageName}`;

  await uploadToS3({
    key: s3Key,
    body: params.zipBuffer,
    contentType: "application/zip",
  });

  const downloadUrl = await generatePreSignedUrl({ key: s3Key });

  return { s3Key, downloadUrl };
}

/**
 * Upload build context for agent deployment
 */
export async function uploadBuildContext(params: {
  testId: string;
  agentCode: string;
  requirements: string;
  dockerfile: string;
  testRunner: string;
}): Promise<{ s3Key: string }> {
  // In a real implementation, this would create a tarball of all files
  // For now, we'll upload individual files
  const basePath = `build-contexts/${params.testId}`;

  await Promise.all([
    uploadToS3({
      key: `${basePath}/agent.py`,
      body: params.agentCode,
      contentType: "text/x-python",
    }),
    uploadToS3({
      key: `${basePath}/requirements.txt`,
      body: params.requirements,
      contentType: "text/plain",
    }),
    uploadToS3({
      key: `${basePath}/Dockerfile`,
      body: params.dockerfile,
      contentType: "text/plain",
    }),
    uploadToS3({
      key: `${basePath}/test_runner.py`,
      body: params.testRunner,
      contentType: "text/x-python",
    }),
  ]);

  return { s3Key: basePath };
}
