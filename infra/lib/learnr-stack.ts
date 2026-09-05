import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as ecrAssets from 'aws-cdk-lib/aws-ecr-assets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

// `__dirname` is a CommonJS global and this package is `"type": "module"`, so
// the repository root is derived from `import.meta.url` instead. Getting this
// wrong fails at synth rather than at deploy, but it fails.
const here = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.join(here, '..', '..');

export interface LearnrStackProps extends StackProps {
  readonly hostedZoneId: string;
  readonly zoneName: string;
  readonly domainNames: string[];
  readonly certificate: acm.ICertificate;
  readonly parameterPrefix: string;
  readonly sentryDsn: string;
  readonly sentryAuthToken: string;
}

export class LearnrStack extends Stack {
  constructor(scope: Construct, id: string, props: LearnrStackProps) {
    super(scope, id, props);

    const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.zoneName,
    });

    // Static assets. Private: reachable only by CloudFront through Origin
    // Access Control, so a 13 KB .m4a never costs a Lambda invocation and the
    // bucket is not a second public front door.
    const assets = new s3.Bucket(this, 'Assets', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const fn = new lambda.DockerImageFunction(this, 'Web', {
      code: lambda.DockerImageCode.fromImageAsset(repositoryRoot, {
        platform: ecrAssets.Platform.LINUX_ARM64,
        buildArgs: {
          NEXT_PUBLIC_SENTRY_DSN: props.sentryDsn,
          SENTRY_AUTH_TOKEN: props.sentryAuthToken,
        },
      }),
      architecture: lambda.Architecture.ARM_64,
      // One full vCPU, so cold init runs at full speed. The decision is to ship
      // without a warmer and add a 5-minute EventBridge ping only if a cold
      // start is actually felt on the iPad.
      memorySize: 1769,
      timeout: Duration.seconds(30),
      environment: {
        SSM_PARAMETER_PREFIX: props.parameterPrefix,
        // CloudFront signs origin requests with SigV4 and the signature covers
        // Host, so the Host reaching this function is the Function URL's and
        // cannot be rewritten. Auth.js would therefore build a Google callback
        // URL pointing at *.lambda-url.ap-southeast-2.on.aws, which Google
        // refuses. Naming the origin explicitly is the fix.
        AUTH_URL: `https://${props.domainNames[0]}`,
        AUTH_TRUST_HOST: 'true',
      },
    });

    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParametersByPath'],
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter${props.parameterPrefix}/*`,
        ],
      }),
    );

    const url = fn.addFunctionUrl({
      // Not NONE: with Origin Access Control below, the function cannot be
      // reached except through the distribution.
      authType: lambda.FunctionUrlAuthType.AWS_IAM,
      // Must agree with AWS_LWA_INVOKE_MODE in the Dockerfile.
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
    });

    const lambdaOrigin = origins.FunctionUrlOrigin.withOriginAccessControl(url);
    const assetOrigin = origins.S3BucketOrigin.withOriginAccessControl(assets);

    // `/_next/image` varies on three query parameters and nothing else. The
    // built-in CACHING_OPTIMIZED policy forwards no query string at all, which
    // would collapse every size and quality onto one cached response.
    const imageCachePolicy = new cloudfront.CachePolicy(this, 'ImageCache', {
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.allowList('url', 'w', 'q'),
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList('Accept'),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      defaultTtl: Duration.days(30),
      minTtl: Duration.days(1),
      maxTtl: Duration.days(365),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      domainNames: props.domainNames,
      certificate: props.certificate,
      defaultBehavior: {
        origin: lambdaOrigin,
        // Every page is either authenticated or a lesson in progress. Nothing
        // here is safe to cache at the edge.
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        // ALL_VIEWER_EXCEPT_HOST_HEADER, not ALL_VIEWER: forwarding the
        // viewer's Host would break the SigV4 signature that Origin Access
        // Control puts on the origin request.
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        // Content-hashed filenames, so this is safe forever.
        '/_next/static/*': {
          origin: assetOrigin,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
        '/sounds/*': {
          origin: assetOrigin,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
        '/_next/image*': {
          origin: lambdaOrigin,
          cachePolicy: imageCachePolicy,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
    });

    for (const domainName of props.domainNames) {
      new route53.ARecord(this, `Alias${domainName}`, {
        zone,
        recordName: domainName,
        target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
      });
      new route53.AaaaRecord(this, `AliasV6${domainName}`, {
        zone,
        recordName: domainName,
        target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
      });
    }

    new CfnOutput(this, 'AssetsBucket', { value: assets.bucketName });
    new CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new CfnOutput(this, 'DistributionDomain', { value: distribution.distributionDomainName });
  }
}
