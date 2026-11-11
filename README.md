<p align="center"><img src="nodes/Rizamo/rizamo.svg" width="64" height="64" alt="Rizamo"></p>

# n8n-nodes-rizamo

The [Rizamo](https://rizamo.com) nodes for [n8n](https://n8n.io): publish and schedule social posts on Instagram, Facebook, TikTok, YouTube and Threads, answer comments and messages, and read analytics, from your workflows.

- **Rizamo:** posts, media, accounts, profiles, analytics, the inbox, comments and short links.
- **Rizamo Trigger:** starts a workflow when a post goes out or fails, a comment or message arrives, or an account disconnects.

## Installation

In n8n, open **Settings**, then **Community Nodes**, choose **Install** and enter:

```text
@rizamohq/n8n-nodes-rizamo
```

Or follow n8n's [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/).

## Credentials

1. In Rizamo, open **Developers** and create an API key. It starts with `rz_live_` and is shown once.
2. In n8n, add a **Rizamo API** credential and paste the key.

A key does at most what the person who made it can do: only their profiles. Limit it to some profiles or [scopes](https://docs.rizamo.com/authentication#scopes) when you create it.

## Operations

| Resource | Operations |
|---|---|
| Post | Create (save as draft, schedule, add to the queue or publish now), get, get many, publish now, delete |
| Media | Upload a binary file, import from a URL, get |
| Account | Get, get many, get TikTok creator info |
| Profile | Get, get many |
| Analytic | Overview of a period against the one before, post performance |
| Inbox Thread | Get many, get, reply, mark done |
| Comment | Hide, unhide, delete |
| Link | Create a short link, get its clicks |

The trigger offers every Rizamo event, such as `post.published`, `post.failed`, `post.target.failed`, `comment.received`, `message.received`, `comment_automation.sent` and `account.disconnected`, and can be limited to some profiles.

## Usage

**Files from earlier nodes.** Create Post takes binary fields (for example `data`, or `data, data2` for a carousel) and uploads them first. JPEG, PNG, WebP, MP4 and MOV, up to 4 GB.

**TikTok.** TikTok has no defaults: under TikTok Options add each choice the post needs (comments, Duet, Stitch, your brand, branded content, AI-generated, privacy for photos) and Consent, which says the account's owner agreed to these choices and TikTok's Music Usage Confirmation. Get TikTok Creator Info shows what the account allows. Or choose Send to TikTok Inbox, and the owner finishes the post in the TikTok app. Rizamo's error names any choice that is missing.

**YouTube.** Made for Kids is required to schedule or publish.

**Retries.** Every write sends an idempotency key, so when n8n tries a node again in the same execution, Rizamo answers with the first result instead of posting twice.

**The trigger** needs an address Rizamo can reach: https on the public internet. n8n Cloud and most hosted n8n have one; on your own computer, use a tunnel. Activating a workflow creates a webhook endpoint in Rizamo (shown under Developers, named after the workflow), and deactivating it deletes it. Each delivery's signature is checked.

## Templates

Five workflows to import, each with a sticky note on setup: blog RSS to the queue, clients' posts from Google Sheets, new Shopify products, a weekly report to Slack, and AI-drafted comment replies approved in Slack. See [templates](templates/).

## Compatibility

Built with n8n's node CLI 0.56 and tried on n8n 2.47 as an installed community package.

## Resources

- [Rizamo API docs](https://docs.rizamo.com)
- [Webhooks](https://docs.rizamo.com/webhooks)
- [n8n community nodes](https://docs.n8n.io/integrations/#community-nodes)
- Support: hi@rizamo.com

## License

[MIT](LICENSE). The Rizamo name and logo are not covered by it.
