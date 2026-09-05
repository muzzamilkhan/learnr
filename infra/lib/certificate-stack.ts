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
 * Issuance also depends on CAA, and the apex is not where that is decided.
 * `muzza.tech` carries `amazon.com` beside the three CAs already there, and
 * that is necessary but not sufficient: a CAA lookup walks *up* the tree only
 * until it finds an RRset, and following a CNAME short-circuits the walk
 * entirely (RFC 8659). Every name under `muzza.tech` without a record of its
 * own matches the wildcard `*.muzza.tech CNAME cname.vercel-dns-017.com.`, so
 * a CAA query for a bare subdomain is answered by *Vercel's* CAA set -
 * `pki.goog`, `sectigo.com`, `globalsign.com`, `letsencrypt.org`, and no
 * Amazon CA. ACM refuses in about two minutes with `CAA_ERROR`, and the apex
 * record is never read.
 *
 * So each name this certificate covers gets its own `CaaAmazonRecord`, which
 * both permits Amazon and - by existing at all - stops the wildcard answering
 * for that name. The certificate depends on them explicitly: created in
 * parallel, the CAA check can race ahead of the record that permits it.
 */
export class CertificateStack extends Stack {
  readonly certificate: acm.ICertificate;

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id, props);

    const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.zoneName,
    });

    // One per covered name. `CaaAmazonRecord` writes `0 issue "amazon.com"`,
    // which is all ACM needs - the four documented values are alternatives.
    const caa = props.domainNames.map(
      (domainName) =>
        new route53.CaaAmazonRecord(this, `Caa${domainName}`, {
          zone,
          recordName: domainName,
        }),
    );

    this.certificate = new acm.Certificate(this, 'Certificate', {
      domainName: props.domainNames[0],
      subjectAlternativeNames: props.domainNames.slice(1),
      // DNS validation renews without a human, which is the whole reason the
      // hosted zone had to move before this stack could exist.
      validation: acm.CertificateValidation.fromDns(zone),
    });

    for (const record of caa) this.certificate.node.addDependency(record);
  }
}
