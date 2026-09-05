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

**2. Seven hostnames are connected to projects, and only two of them have a
record. The other five ride the wildcard.**

| Host | Project | How it resolves |
| --- | --- | --- |
| `muzza.tech` | `portfolio` | apex A records |
| `learnr.muzza.tech` | `learnr` | its own CNAME |
| `bottle.muzza.tech` | `message-bottle` | **the wildcard** |
| `quests.muzza.tech` | `family-quests` | **the wildcard** |
| `gym.muzza.tech` | `workout-planner` | **the wildcard** |
| `villagers.muzza.tech` | `villagers-game` | **the wildcard** |
| `finance.muzza.tech` | `future-finance-v2` | **the wildcard** |

Read this list off the dashboard's **Connected Projects**, not off
`vercel project ls`: that command prints each project's *latest production
URL*, which for four of these is still the `*.vercel.app` one even though a
`muzza.tech` hostname is connected. Taking it as the inventory undercounts by
four, which is how this note first had the number wrong.

So the plan's "recreate the records for the other eight apps" is really
**recreate one wildcard**, and that wildcard is load bearing for five live
apps. None of them has a record of its own; an invented name resolves to
Vercel's IPs exactly as they do.

**`*.muzza.tech` is not limited to one label** - it answers for
`aws.learnr.muzza.tech` too, which is worth knowing because it means the
staging host is *not* NXDOMAIN in the new zone and would silently serve Vercel
until the CDK's explicit record shadows it. An explicit record always beats a
wildcard, so the stack works; the wildcard is what answers in the gap before
`cdk deploy` first runs.

**And a name below a CNAME is fine here, which is not obvious.**
`aws.learnr.muzza.tech` sits under `learnr.muzza.tech`, which is a CNAME, and
DNS is famously murky about data beneath one. This zone settles it by example:
`send.learnr.muzza.tech` and `resend._domainkey.learnr.muzza.tech` already sit
there and resolve on the live internet today. It also stops being a question at
cutover, when `learnr.muzza.tech` becomes an A-alias to CloudFront rather than
a CNAME.

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
certificate stack. Do not simply delete the CAA records instead: they are doing
a real job for the three CAs already there.

**Confirmed against ACM's documentation, 5 September 2026: the staged zone is
already correct and needs nothing further.** ACM names four acceptable values -
`amazon.com`, `amazontrust.com`, `awstrust.com`, `amazonaws.com` - and they are
**alternatives, not a set**: the documentation reads "your CAA record value
field must contain one of the following domain names", and issuance fails only
where none of the four is present. The `amazon.com` staged here satisfies it
alone. The one thing that would still block issuance is an `issuewild` record
naming no Amazon CA, since `issuewild` overrides `issue` for wildcards - this
zone has none, so wildcards are not separately refused either. Sources:
`docs.aws.amazon.com/acm/latest/userguide/setup-caa.html` and
`.../troubleshooting-caa.html`. Worth re-reading only if AWS changes CAs.

TTL 60 on the existing CAA records means a correction propagates in a minute,
which is the one mercy here.

**5. The apex CAA is not what ACM reads, and the wildcard is why.** Found by
deploying: the certificate failed in **two minutes** with `CAA_ERROR`, not by
sitting in validation. A CAA lookup walks *up* the tree only until it finds an
RRset, and **following a CNAME short-circuits the walk entirely** (RFC 8659).
`aws.learnr.muzza.tech` had no record of its own, so it matched
`*.muzza.tech CNAME cname.vercel-dns-017.com.` - and the CAA set answered was
*Vercel's*, at the CNAME target:

```
0 issue "pki.goog"   0 issue "sectigo.com"
0 issue "globalsign.com"   0 issue "letsencrypt.org"
```

No Amazon CA, and `muzza.tech`'s own `amazon.com` never consulted. Point 4
above is correct and was still not sufficient: **the apex record is necessary
and only decides names that actually reach the apex.**

The fix is a CAA record on each covered name, which both permits Amazon and -
by existing at all - stops the wildcard answering for that name.
`CertificateStack` writes one per name (`CaaAmazonRecord`) and the certificate
`DependsOn` them, since created in parallel the CAA check can race ahead of the
record permitting it. **Budget for the stale answer**: the wildcard's reply
caches for 1800s, so a redeploy inside half an hour of the first failure fails
again for a reason already fixed.

**This bites again at cutover, and worse.** `learnr.muzza.tech` is a CNAME to
Vercel today, so a certificate covering it would fail CAA exactly the same way -
and the repair used here is unavailable, because **a CAA record cannot coexist
with a CNAME at the same name**. Route 53 refuses the change outright. Once the
name is an A-alias to CloudFront the walk reaches the apex and works, but the
alias cannot be created before the certificate that lets the distribution serve
the name. Task 10 has to break that circle deliberately - the likely move is to
replace the CNAME with plain A records at Vercel's addresses first, which makes
the name non-CNAME and lets CAA reach the apex while production keeps serving,
then issue and flip. **Decide this before the cutover, not during it.**

## What is already done

**`learnr.muzza.tech` is at TTL 60 already**, so Task 4 step 4 - lower the TTL
before cutover so the rollback is fast - needs nothing. Keep it at 60 through
the migration. Everything else can keep the TTLs above.

**The Route 53 zone is staged and verified, and is inert.** Task 4 steps 2, 3
and 5 are done; the zone answers nothing until the nameservers move, which is
step 6 and is the only part left.

```
zone id       Z07486711LOMQSHZAG6ZM        # -c hostedZoneId=... for the CDK
nameservers   ns-217.awsdns-27.com
              ns-677.awsdns-20.net
              ns-1271.awsdns-30.org
              ns-1610.awsdns-09.co.uk
```

Twelve record sets: the ten above, plus the `NS` and `SOA` Route 53 writes
itself. Every value was read from live DNS and assembled programmatically
rather than retyped - a DKIM key is 220 characters on one line and a hand
transcription that breaks it fails silently.

Verified with `aws route53 test-dns-answer`, which asks the new zone
authoritatively over the API and so works from a machine that cannot send UDP
port 53. Eleven checks against the live Vercel answers, all matching: both DKIM
keys and both SPF records byte-identical, the MX pair identical, the `learnr`
CNAME identical, the apex a superset of whatever four-address subset Vercel
returns on a given query, the CAA a superset by exactly `amazon.com`, and
`finance` and `quests` served by the wildcard.

**Two things to check in the Vercel dashboard after the nameservers move**, both
of which are quiet rather than loud:

- **Each of the seven connected domains still shows a valid configuration.**
  Five of them arrive through the generic `cname.vercel-dns-017.com` rather
  than a per-project hostname like `learnr`'s, which is the ordinary external
  DNS setup and should verify - but Vercel is the thing that decides, and a
  domain it marks invalid stops serving.
- **Resend still shows both domains verified.** The DKIM and SPF records are
  copied faithfully, so it should; it is worth looking, because the failure is
  a parent not receiving a sign-up code rather than anything visible.

Rolling this back before the nameservers move is
`aws route53 delete-hosted-zone --id Z07486711LOMQSHZAG6ZM` after emptying it,
and costs nothing but the $0.50 the zone accrues monthly.
