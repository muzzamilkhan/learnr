# muzza.tech DNS, as it stood before Route 53

Taken 5 September 2026, from `vercel dns ls muzza.tech`, `vercel project ls`,
`vercel domains ls` and live resolution over DNS-over-HTTPS against Cloudflare.
This is Task 4 step 1 of `plans/2026-09-04-aws-migration.md` - the inventory
that has to come across before the nameservers move.

**Registrar and nameservers: Vercel.** `ns1.vercel-dns.com`, `ns2.vercel-dns.com`
(TTL 86400). Registration expires 16 August 2027; transfer-out locked until
15 October 2026, which does not block a nameserver change.

## Every record

Vercel splits these into records you added and records it calls `default`. The
`default` ones are not optional - they are what makes the apex and every
subdomain resolve.

| Name | Type | Value | TTL |
| --- | --- | --- | --- |
| `muzza.tech` | A | `216.198.79.1`, `216.198.79.65` | 1800 |
| `muzza.tech` | CAA | `0 issue "letsencrypt.org"` | 60 |
| `muzza.tech` | CAA | `0 issue "pki.goog"` | 60 |
| `muzza.tech` | CAA | `0 issue "sectigo.com"` | 60 |
| `*.muzza.tech` | ALIAS | `cname.vercel-dns-017.com.` | default |
| `learnr` | CNAME | `357a7a3140584e1e.vercel-dns-017.com.` | 60 |
| `resend._domainkey` | TXT | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDVGWm3IWOP3w…` | 3600 |
| `send` | TXT | `v=spf1 include:amazonses.com ~all` | 3600 |
| `send` | MX | `10 feedback-smtp.ap-northeast-1.amazonses.com.` | 3600 |
| `resend._domainkey.learnr` | TXT | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCwPHJh+em23P…` | 3600 |
| `send.learnr` | TXT | `v=spf1 include:amazonses.com ~all` | 3600 |
| `send.learnr` | MX | `10 feedback-smtp.ap-northeast-1.amazonses.com.` | 3600 |

The two DKIM public keys are truncated here on purpose - copy them from
`vercel dns ls muzza.tech`, not from this file. They are long, they are one
line each, and a DKIM key transcribed with a line break silently stops
verifying.

## Four things the plan did not know

**1. There is no inbound mail, so the plan's headline risk is smaller than it
looks - and the real one is outbound.** The plan says the quiet failure mode is
email, and it is, but not the one it describes. `muzza.tech` has **no apex MX,
no apex TXT and no DMARC record**: there is no mailbox here, so nobody is going
to fail to get a reply. The `send` and `send.learnr` MX records are Amazon
SES's *bounce and complaint* path for Resend, not somewhere mail arrives.

What breaks instead is *sending*. Drop `resend._domainkey.learnr` or
`send.learnr` and the sign-up code email fails DKIM and SPF - so it lands in
spam or is rejected outright, and a parent cannot create an account at all. The
same records exist twice because two domains are verified in Resend,
`muzza.tech` and `learnr.muzza.tech`; the app sends as
`noreply@learnr.muzza.tech`, so **the `.learnr` pair is the one that is load
bearing.** Carry both anyway.

**2. Only one of the nine apps has a DNS record. The rest ride the wildcard.**
Four apps are on a `muzza.tech` hostname:

| Host | Project | How it resolves |
| --- | --- | --- |
| `muzza.tech` | `portfolio` | apex A records |
| `learnr.muzza.tech` | `learnr` | its own CNAME |
| `finance.muzza.tech` | `future-finance-v2` | **the wildcard** |
| `quests.muzza.tech` | `family-quests` | **the wildcard** |

The other four projects are on `*.vercel.app` and have no custom domain.
Confirmed by resolution: `finance.muzza.tech` and `quests.muzza.tech` return no
CNAME of their own, and an invented name
(`definitely-not-a-real-app-xyz.muzza.tech`) resolves to Vercel's IPs. So the
plan's "recreate the records for the other eight apps" is really **recreate one
wildcard**, and that wildcard is load bearing for two live apps.

`*.muzza.tech` matches one label, so it does **not** cover
`aws.learnr.muzza.tech` - which is NXDOMAIN today and free for the staging
host. The CDK stack creates that record itself.

**3. The apex cannot be an alias in Route 53, and that is the one genuine
downgrade.** Vercel's apex `ALIAS` is proprietary: it CNAME-like-resolves the
zone apex to a hostname, which ordinary DNS forbids. Route 53's own alias
records only point at AWS resources, and Vercel is not one - so the apex has to
become **plain A records at `216.198.79.1` and `216.198.79.65`**, which are
Vercel's anycast addresses and Vercel's to change without telling anyone. It is
correct on the day and quietly rots.

That is fine while `portfolio` is still on Vercel and stops mattering the
moment it follows LearnR onto CloudFront, where the apex becomes a real Route
53 alias to a distribution. Worth doing early for that reason rather than
leaving the portfolio last.

The wildcard has no such problem: `*.muzza.tech CNAME cname.vercel-dns-017.com`
is legal, because only the apex forbids a CNAME.

**4. The CAA records will refuse to let ACM issue the certificate.** This one
blocks Task 5 and appears nowhere in the plan. A CAA record is an allow-list of
certificate authorities, and this zone names three: `letsencrypt.org`,
`pki.goog`, `sectigo.com`. ACM issues from Amazon Trust Services, which is none
of them - so `cdk deploy` would sit in certificate validation and eventually
fail, with DNS validation records that look perfectly correct.

Add `amazon.com` to the CAA set when recreating the zone, before deploying the
certificate stack. AWS also documents `amazontrust.com`, `awstrust.com` and
`amazonaws.com`; **confirm the exact set against ACM's own documentation at the
time** rather than trusting this line - it is the sort of list that gets added
to. Do not simply delete the CAA records instead: they are doing a real job for
the three CAs already there.

TTL 60 on the existing CAA records means a correction propagates in a minute,
which is the one mercy here.

## What is already done

**`learnr.muzza.tech` is at TTL 60 already**, so Task 4 step 4 - lower the TTL
before cutover so the rollback is fast - needs nothing. Keep it at 60 through
the migration. Everything else can keep the TTLs above.
