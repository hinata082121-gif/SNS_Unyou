This repository contains the ICHI Social landing page and internal operation docs for sales, deal management, and delivery workflows.

## Operation Docs

- Sales automation: `docs/hermes-daily-sales-workflow.md`
- Deal/proposal workflow: `docs/deals/`
- Delivery/content operation workflow: `docs/delivery/`
- Knowledge index and operations navigation: `docs/knowledge/`
- Infrastructure and operations troubleshooting: `docs/infra/` and `docs/knowledge/troubleshooting-index.md`
- Product packaging and pricing rules: `docs/product/`
- Outsourcing and hiring workflow rules: `docs/outsourcing/`
- AI operations improvement rules: `docs/ai-ops/`
- Instagram-first sales prospecting: `docs/sales-targeting-rules.md` and `hermes/prompts/instagram-sales-list-builder.md`
- Self SNS content generation: `docs/pr/` and `hermes/prompts/weekly-self-content-builder.md`
- Hermes prompts: `hermes/prompts/`

Do not commit API keys, passwords, SNS login details, `SHEETS_SECRET_TOKEN`, or real webhook URLs.
Do not automate Instagram DMs, comments, follows, likes, or self SNS posting; generate drafts for human review and manual posting only.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
