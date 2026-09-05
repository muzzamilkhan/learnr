import { Stack, StackProps } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

export interface CertificateStackProps extends StackProps {
  readonly hostedZoneId: string;
  readonly zoneName: string;
  readonly domainNames: string[];
}

/**
 * A stack of its own solely because CloudFront accepts certificates from
 * `us-east-1` and no other region, wherever the rest of the application lives.
 * It is provisioned explicitly rather than left to be discovered: this is the
 * single most reliable way to lose an afternoon to this design.
 *
 * Issuance also depends on the zone's CAA records naming an Amazon CA. ACM
 * documents four - `amazon.com`, `amazontrust.com`, `awstrust.com`,
 * `amazonaws.com` - and any one of them is enough; `muzza.tech` carries
 * `amazon.com` beside the three CAs that were already there. Without it this
 * stack sits in validation with DNS records that look perfectly correct.
 */
export class CertificateStack extends Stack {
  readonly certificate: acm.ICertificate;

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id, props);

    const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.zoneName,
    });

    this.certificate = new acm.Certificate(this, 'Certificate', {
      domainName: props.domainNames[0],
      subjectAlternativeNames: props.domainNames.slice(1),
      // DNS validation renews without a human, which is the whole reason the
      // hosted zone had to move before this stack could exist.
      validation: acm.CertificateValidation.fromDns(zone),
    });
  }
}
