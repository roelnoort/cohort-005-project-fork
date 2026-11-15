# Which email provider should Cadence wire into Knock?

Researched 2026-11-15 against primary sources only (docs.knock.app and provider-owned docs/pricing pages). Prices and limits change, so re-check the pricing pages before you sign up.

## Question

Cadence sends six low-volume transactional notifications through Knock: the in-app feed plus an immediate email. Cadence has no email provider yet, and the seeded dev users have fake addresses. Which email provider should the Knock email channel use in development, and which in production?

## Answer / Recommendation

- **Development: use Knock's built-in test channel with sandbox mode on in the `development` environment.** It needs no provider account and no DNS. It is on by default in every environment. With sandbox mode on, Knock renders every email for preview in the dashboard, never delivers it, and doesn't count it toward usage. That suits fake seed addresses. To see a real inbox render, turn sandbox off and set the channel's **To** override to a Knock account member's address. Expect 100 emails/month and member-only recipients.
  - Alternative if you want a real inbox that catches everything: Knock's **Mailtrap** channel in **Testing** API mode. The Mailtrap free plan allows 50 test emails/month.
- **Production: Resend.** Its free tier (3,000/month, 100/day) covers Cadence's volume. The Knock config is only an API key and a From address, plus an optional webhook. It needs a verified sending domain (a subdomain such as `notifications.<domain>`, with DKIM, SPF and MX records). **Postmark** is the runner-up. Its free tier is only 100 emails/month, and a new account must pass manual approval.
- Avoid **SES** for this case: it needs IAM, SNS webhooks and a sandbox exit that takes up to 96 hours. Avoid **SendGrid**: it only has a one-time 60-day trial. Avoid **SMTP**: Knock can't track delivery over SMTP.

## Findings

### 1. Email providers Knock supports

The Knock email overview lists 13 providers: **Knock (testing only)**, Amazon SES, Cloudflare Email, MailerSend, Mailgun, Mailjet, Mailtrap, Mandrill, Postmark, Resend, SendGrid, SMTP and SparkPost. Delivery tracking is available for all of them except Cloudflare Email and SMTP. Bounce support is listed for Knock, SES, MailerSend, Mailgun, Postmark, Resend and SendGrid [K1].

### 2. Knock's test channel, sandbox mode, environments and overrides

**Built-in test channel** [K2]:
- "This provider is for testing only". Knock says to configure a real provider for user-facing email.
- It is "limited to sending emails to email addresses associated with the members of your Knock account only". Other addresses fail with a `knock_recipient_not_allowed` delivery error (the error name comes from a search summary of [K2]).
- "You can send up to 100 emails per month for free". Beyond that, emails "will be marked as undelivered".
- It is "enabled and ready to use across all environments with no additional configuration required". The From address is Knock's own and is read-only.
- It supports sandbox mode, open and link tracking, CSS inlining, and the From name, To, Cc, Bcc, Reply-to and payload overrides.
- **Not verified:** rate limits and any Knock branding in the email body. The docs don't mention either.

**Sandbox mode** [K3][K4][K5][K6]:
- "Sandbox mode enables you to generate and preview messages for a given channel without delivering them". It is "supported across all channel types (except for in-app)".
- You turn it on under **Advanced** in a channel's environment settings. You can save the config without provider credentials while sandbox is on [K3].
- Sandboxed messages get the status **Not sent**: "processed successfully but was not sent to the downstream provider because your channel is in sandbox mode" [K4].
- "Sandboxed messages are rendered for preview in the Knock dashboard, but do not count toward usage" [K5]. **This answers the "inspect rendered emails without delivering" question: yes.**
- The workflow test runner has its own sandbox toggle. It forces every message into sandbox "regardless of how sandbox mode is configured on each channel" [K6].

**Environments** [K3][K7]:
- An account starts with `production`. Enabling environments adds `development`. Each environment has its own API keys [K7].
- Integrations live at the account level. "A channel's name, key, description, and visibility are set once". "Its provider settings, overrides, and conditions are set per environment" [K3].
- So `development` can use sandbox mode while `production` uses Resend credentials. Channel config doesn't go through commit and promote [K3][K7].
- A new environment gets no provider credentials until you configure them [K7].
- Note that Knock models the email provider as a property of a *channel*. I did not check whether a single channel can point at a different provider in each environment, or whether you need two channels (for example `knock-test` and `resend`) with a per-environment condition. The test channel is a separate channel from a Resend channel [K2][K1]. **Check this in the dashboard before you build the workflow.**

**Recipient overrides** [K8]:
- Every email channel has **To / Cc / Bcc / Reply-to / From name** overrides at the channel level (per environment) or the template level, and they support Liquid.
- **To** "overrides the default recipient address" (normally `recipient.email`).
- This is how you send all dev email to one real inbox. Provider credentials don't support dynamic values.

### 3. Candidate providers

Every Knock provider channel below also offers Knock sandbox mode, Knock open/link tracking, CSS inlining (on by default), overrides and per-environment conditions [K9]–[K14].

| Provider | Free tier (as of 2026-11-15) | Knock config fields | Domain verification | Provider-side test mode |
|---|---|---|---|---|
| **Resend** | 3,000/mo, "limited to 100 emails per day", 3 domains, 30-day retention. Pro is $20/mo for 50k [R1] | API key, From email address, optional Incoming webhook (Resend events `email.delivered/bounced/suppressed/complained`) [K9] | You must "add and verify at least one domain". A DKIM TXT at `resend._domainkey`, SPF TXT + MX on `send.` (newer domains may get CNAMEs), and a subdomain is recommended [R2][R3]. DMARC is advised after verification [R2] | Test addresses `delivered@`, `bounced@`, `complained@` and `suppressed@resend.dev`, with `+label` support [R4] |
| **Postmark** | Developer plan: 100/mo, "No overages". Basic is $15/mo for 10k [P1] | API key (server token), From email address, Incoming webhook, provider open/link tracking. There is no stream field, so use a `MessageStream` payload override [K10] | DKIM TXT and Return-Path CNAME → `pm.mtasv.net` [P2]. Until a manual account approval (usually under 24h on weekdays), you can only send to your own verified domains [P3] | Sandbox *server* type ("works the same way as a real Server, except for the actual email delivery"). `POSTMARK_API_TEST` token validates without sending. `test@blackhole.postmarkapp.com` drops mail but counts toward the limit [P4] |
| **SendGrid** | No permanent free plan: a one-time 60-day trial at 100/day. Essentials starts at $19.95/mo [S1] | API key, From email address, Incoming webhook or polling of Delivery status (needs the Email Activity add-on), provider tracking [K11] | Not researched in detail | API `mail_settings.sandbox_mode` validates a send without delivering. Returns 200, with no events and no credits used [S2] |
| **Amazon SES** | No SES-specific free tier. General AWS Free Tier credits (up to $200, 6 months). $0.10 per 1,000 [A1] | AWS region, auth scheme (Access key ID + secret, *or* Role ARN + External ID), From email address. The Incoming webhook needs an SNS topic wired to the SES identity [K12] | You must verify the From/Return-Path identities even in production [A2] | Accounts start in a per-region sandbox: verified recipients or the mailbox simulator only, 200 per 24h, 1/sec. Production access review takes "within 96 hours" [A2] |
| **Mailgun** | Free: 100/day, 1 custom domain, 1-day log retention. Basic is $15/mo for 10k [M1] | API key, region (US/EU), Domain (verified), From email address [K13] | A custom domain is needed to send to arbitrary addresses [M2] | Sandbox domain: up to 5 authorized recipients, each of whom must accept an invite [M2] |
| **Mailtrap** | Sandbox (testing): 50 test emails/mo, 1 sandbox keeping 10 emails, 1 email per 10s. Live sending: 4,000/mo (150/day) [T1] | API key, **API: Sending or Testing**, Inbox ID (Testing), From email address [K14] | Needed for live sending only (not researched) | The Testing API delivers into a Mailtrap inbox, so any recipient address works. That fits fake seed users [K14][T1] |
| **SMTP** | Depends on the relay | SMTP host, username, password, port (587 default, must support TLS), From email address, SSL toggle [K15] | Depends on the relay | None. Knock "cannot currently track deliverability" over SMTP (messages show "Sent", never "Delivered"), and only header payload overrides work [K15] |

**Not verified:**
- SendGrid's current paid prices. Its pricing pages redirect and the figures differ between them, so the $19.95 comes from a search summary [S1].
- Whether Resend's shared `onboarding@resend.dev` sender (send to your own address only) still exists. It isn't on the pages I read.
- Postmark's full DNS list beyond DKIM and Return-Path.

### 4. Why this recommendation fits Cadence

- **Dev:** Fake seed addresses rule out real delivery. Knock sandbox mode gives a rendered preview of every email in the message log at zero cost and with no setup [K3][K5]. It is the only option that works for every seeded user without DNS or a third-party account.
- **Prod:** Six low-volume transactional emails fit Resend's free tier (3,000/mo) [R1]. Postmark's free tier (100/mo) [P1] is too small for real use, and SendGrid's trial expires [S1]. Resend's Knock config is the smallest (API key + From) [K9], and its webhook gives delivered/bounced status in Knock's message log [K9]. Before launch, verify a sending subdomain [R3] and add DMARC [R2].

## Sources

- [K1] https://docs.knock.app/integrations/email/overview
- [K2] https://docs.knock.app/integrations/email/knock-test
- [K3] https://docs.knock.app/integrations/overview
- [K4] https://docs.knock.app/send-notifications/message-statuses
- [K5] https://docs.knock.app/manage-your-account/knock-plans
- [K6] https://docs.knock.app/send-notifications/testing-workflows
- [K7] https://docs.knock.app/version-control/environments
- [K8] https://docs.knock.app/integrations/email/settings
- [K9] https://docs.knock.app/integrations/email/resend
- [K10] https://docs.knock.app/integrations/email/postmark
- [K11] https://docs.knock.app/integrations/email/sendgrid
- [K12] https://docs.knock.app/integrations/email/aws-ses
- [K13] https://docs.knock.app/integrations/email/mailgun
- [K14] https://docs.knock.app/integrations/email/mailtrap
- [K15] https://docs.knock.app/integrations/email/smtp
- [R1] https://resend.com/pricing
- [R2] https://resend.com/docs/dashboard/domains/introduction
- [R3] https://resend.com/docs/knowledge-base/what-if-my-domain-is-not-verifying
- [R4] https://resend.com/docs/dashboard/emails/send-test-emails
- [P1] https://postmarkapp.com/pricing
- [P2] https://postmarkapp.com/support/article/how-do-i-verify-a-domain
- [P3] https://postmarkapp.com/support/article/1084-how-does-the-account-approval-process-work
- [P4] https://postmarkapp.com/support/article/1213-best-practices-for-testing-your-emails-through-postmark
- [S1] https://support.sendgrid.com/hc/en-us/articles/35270136965403-Overview-of-60-Day-Free-Trial-Plans-for-New-SendGrid-Accounts and https://www.twilio.com/en-us/products/email-api/pricing
- [S2] https://www.twilio.com/docs/sendgrid/for-developers/sending-email/sandbox-mode
- [A1] https://aws.amazon.com/ses/pricing/
- [A2] https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html
- [M1] https://www.mailgun.com/pricing/
- [M2] https://help.mailgun.com/hc/en-us/articles/217531258-Authorized-Recipients and https://documentation.mailgun.com/docs/mailgun/user-manual/domains/domains-sandbox
- [T1] https://mailtrap.io/pricing/
