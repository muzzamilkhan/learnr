This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Curriculum source

The maths questions in Learnr are written against the **Australian Curriculum
Version 9.0 — Mathematics (Foundation to Year 10)**, published by the Australian
Curriculum, Assessment and Reporting Authority (ACARA).

The specific document the Kindergarten to Year 6 content was written from is
ACARA's [Mathematics: Scope and sequence F–10 (v9.0)](https://www.australiancurriculum.edu.au/content/dam/en/curriculum/ac-version-9/downloads/mathematics/mathematics-scope-and-sequence-f-10-v9.docx),
downloaded from the [Australian Curriculum website](https://www.australiancurriculum.edu.au).

Every question template in `src/content/maths.ts` records the content
description it practises in its `tags`, so any question can be traced back to the
curriculum. The codes read as `AC9M` + year + strand + number — for example
`AC9M4N02`, Year 4 Number: *"explain and use the properties of odd and even
numbers"*. Foundation is `F` (Kindergarten in this app), and the strands are `N`
number, `A` algebra, `M` measurement, `SP` space, `ST` statistics and `P`
probability. `src/content/catalog.test.ts` checks that no template ships without
a code.

### Attribution

> © Australian Curriculum, Assessment and Reporting Authority (ACARA) 2010 to
> present, unless otherwise indicated. This material was downloaded from the
> [Australian Curriculum website](http://www.australiancurriculum.edu.au)
> (accessed 17 August 2026) and was modified. The material is licensed under
> [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

The material was modified in the sense that Learnr writes its own practice
questions against the content descriptions; it does not reproduce ACARA's
material verbatim.

### Disclaimer

> ACARA does not endorse any product that uses the Australian Curriculum or make
> any representations as to the quality of such products. Any product that uses
> material published on the Australian Curriculum website should not be taken to
> be affiliated with ACARA or have the sponsorship or approval of ACARA. It is up
> to each person to make their own assessment of the product, taking into account
> matters including the degree to which the materials align with the content
> descriptions and achievement standards.

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
