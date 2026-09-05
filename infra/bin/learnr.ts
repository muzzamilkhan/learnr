#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { CertificateStack } from '../lib/certificate-stack.js';
import { LearnrStack } from '../lib/learnr-stack.js';

const app = new App();

const account = process.env.CDK_DEFAULT_ACCOUNT!;
const zoneName = 'muzza.tech';
const hostedZoneId = app.node.tryGetContext('hostedZoneId') as string;

// `domainNames` is context rather than a constant so the cutover in Task 10 is
// a one-line change: the staging host alone until production moves, then both.
const domainNames = ((app.node.tryGetContext('domainNames') as string) ?? 'aws.learnr.muzza.tech')
  .split(',')
  .map((name) => name.trim());

const certificates = new CertificateStack(app, 'LearnrCertificate', {
  // CloudFront takes certificates from us-east-1 and nowhere else.
  env: { account, region: 'us-east-1' },
  crossRegionReferences: true,
  hostedZoneId,
  zoneName,
  domainNames,
});

new LearnrStack(app, 'Learnr', {
  env: { account, region: 'ap-southeast-2' },
  crossRegionReferences: true,
  hostedZoneId,
  zoneName,
  domainNames,
  certificate: certificates.certificate,
  parameterPrefix: '/learnr/prod',
  sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? '',
  sentryAuthToken: process.env.SENTRY_AUTH_TOKEN ?? '',
});
