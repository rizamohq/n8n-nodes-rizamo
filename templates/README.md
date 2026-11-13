# Templates

Workflows for [n8n.io/workflows](https://n8n.io/workflows) that use the Rizamo node. Import one in n8n with **Import from File**, then follow its sticky note.

## Share new blog articles on social media from RSS with Rizamo

`blog-rss-to-social-queue.json`

Each new article in your blog's RSS feed becomes a post in your Rizamo queue, with the image the article shares. Articles with an image go to every account you choose, Instagram included; the others go to text accounts such as Facebook and Threads.

## Schedule clients' social posts from Google Sheets with Rizamo

`agency-google-sheets-to-scheduled-posts.json`

For agencies: each row of a Google Sheet with Status Ready becomes a scheduled post on that client's Rizamo profile, with its images or video. The row is marked Scheduled with the post's ID, or shows the error when Rizamo refuses it.

## Post new Shopify products to Instagram and Facebook with Rizamo

`shopify-new-product-to-social.json`

When an active product with a photo is created in Shopify, Rizamo adds a post with up to four photos, its title, lowest price and link to your profile's queue for Instagram, Facebook or any account you choose.

## Send a weekly social media report to Slack with Rizamo

`weekly-social-report-to-slack.json`

Every Monday at 8:00, Rizamo's views, reach and engagements for the last 7 days, against the 7 before, and the week's top three posts go to a Slack channel.

## Draft replies to social media comments with AI and approve them in Slack with Rizamo

`ai-comment-replies-approved-in-slack.json`

Each new comment on your Instagram, Facebook, TikTok, YouTube or Threads posts gets a reply drafted by OpenAI. It goes to Slack with Approve and Reject buttons, and Rizamo posts the reply only when someone approves.
