# Content extraction: 505 templates to versioned JSON

**Build-order step 2** of `2026-08-26-ios-port-design.md`. Step 1, the API
server, is done and cut over. This is the step the Swift port is blocked on:
template generation, the eleven figure builders and the session state machines
all need the content pack, and until it exists the iOS app cannot generate a
question and says so on screen.

## The change in one paragraph

The 505 shipped templates become fourteen versioned JSON packs, one per subject
and school year, generated from the TypeScript literals that authors keep
editing. The web app consumes the packs directly - `catalog.ts` is sourced from
them instead of from the literals - so the format is proven by the application
that already ships it rather than by a round-trip test. The API grows two public
endpoints serving the same files, which is how iOS gets content without an App
Store release.

## What was measured first

The whole design rests on the templates being inert data by the time
`allTemplates` exists, so that was checked before anything else.

**The helpers run at authoring time, not runtime.** `wordFrom`, `equalSectors`,
`shadedFills`, `dayName`, `shapeName`, `solidWord` and `columnLetter` are `Expr`
*string builders*, evaluated at module load. Nothing survives into the value but
the strings they produced. Extraction is therefore a serialization and not a
port - and it is why nothing in `src/content/*/helpers.ts` has to exist twice.

**It round-trips exactly, and it is small.** Serializing the live catalog:

| | Templates | Packs |
| --- | --- | --- |
| maths K-6 | 350 | 7 |
| english K-6 | 155 | 7 |
| **Total** | **505** | **14** |

416,032 bytes serialized, 21-59 KB a pack; the largest single template is
`english.6.figurative-language.same-device` at 9.4 KB. Every field is a string,
number, boolean, array or plain object. `FigureSpec` is a discriminated union on
`kind` whose every field is an `Expr`, which is a string. There is no function,
`RegExp`, `Date` or `undefined`-bearing value anywhere in the corpus. The
`RegExp`s in `SYLLABUSES` are catalog metadata and are not in a pack.

## Five decisions, and what each rejects

**The TypeScript literals stay the authoring source.** The packs are generated
and committed. The alternative - deleting the year files and authoring JSON
directly - buys one representation and no build step, and costs the helpers:
`shadedFills` emits nested ternary chains hundreds of characters long, and a
frozen chain is not something anyone edits by hand. Content is 505 AI-authored
templates expected to churn, so the cost lands every time content changes and
the saving lands once.

The price is two representations and a build step to forget, paid for by the
drift test below, which makes forgetting a red suite rather than a stale pack.

**The web app imports the packs at build time and never fetches them.** All
eleven catalog call sites are synchronous server-side renders - the landing
page, the level picker, `/curriculum`, `/play`, `/children`, `/progress`. Making
them async would give screens that cannot currently fail a "couldn't load"
state, for content that ships in the bundle either way. The literal reading of
"consumed by web first" would have the web call the endpoint like iOS does; what
matters is that the web consumes the pack *format*, and it does. The wire is a
thin shell over a file both halves read.

**The packs ship inside the API bundle.** Updating content is a commit plus
`fly deploy`, about a minute. That is deploy-free where it counts - no App Store
release - which is what the value actually was. Storing content in Postgres or
blob storage buys a genuinely deploy-free update at the cost of an upload,
validation, versioning and rollback surface, a second place content can be
wrong, and an external read on a request that currently cannot fail. Nobody has
asked for it.

**`GET /content/*` is public.** Content is not personal data, and the landing
page already renders coverage from these very templates to signed-out visitors.
Public makes the response cacheable and lets iOS refresh its bundled copy before
a child has ever signed in. It follows `GET /shares/:token`: public where being
public is what makes it work.

**A version is derived and never written.** A pack's `version` is `sha256` of
its own bytes with the `version` field excluded, truncated to 12 hex characters;
the manifest's is a hash over the fourteen `subject.level:etag` lines. A
hand-bumped number is one more thing to forget, and a forgotten bump leaves iOS
on stale content with every test green. Derived cannot disagree with the bytes it
names. Ordering is not needed: the question a client asks is "different?", not
"newer?".

## Artifacts

```
src/content/packs/manifest.json
src/content/packs/maths.K.json  … maths.6.json      (7)
src/content/packs/english.K.json … english.6.json   (7)
```

Inside `src/content/`, which is the window `packages/core/src` symlinks, so both
applications reach them by the same path.

A pack:

```json
{
  "version": "9f3c1a2b7d04",
  "subject": "maths",
  "level": "3",
  "templates": [ … ]
}
```

`subject` and `level` are beyond what the spec asked for (`{ version, templates }`),
because a file that names itself cannot be misfiled.

The manifest is `listSubjects()`'s existing shape with an etag per level:

```json
{
  "version": "4c81e6f0ab19",
  "subjects": [
    { "subject": "english", "levels": [ { "level": "K", "topics": ["…"], "templateCount": 21, "etag": "…" } ] },
    { "subject": "maths",   "levels": [ … ] }
  ]
}
```

A pack's `version` and the `etag` the manifest carries for it are the same
value, written twice so that neither file has to be read to make sense of the
other. So a client renders a level picker from the manifest alone, without
downloading a template.

**Packs are pretty-printed at two-space indent.** About 1.2 MB committed instead
of 406 KB, which is nothing, and it buys the thing that matters: the pack diff is
the reviewable artifact for a content change. The hash is over those exact bytes,
because they are what is served.

## The generator

`scripts/build-content.ts`, run as `npm run content:build`.

It imports `src/content/maths/index.ts` and `src/content/english/index.ts`
**directly, never `catalog.ts`** - which is about to be sourced from its output.
That is what keeps the cycle from closing, and it is the one structural rule of
this file.

**It validates before it writes.** Every template through `validateTemplate`;
one failure and nothing is written. Emitting a broken pack is impossible rather
than merely tested against.

`mathsTemplates` and `englishTemplates` keep their exports and stop being
runtime code: after this the generator and `packs.test.ts` are their only
importers. That is the intended end state, not dead code - they are the source a
human edits.

Determinism: templates keep catalog order, which is school order within a year
file, and `JSON.stringify` preserves an object literal's authored key order. So
regeneration is byte-stable, and reordering fields in a literal is a real if
cosmetic content change that produces a new hash and one harmless refetch.

## `catalog.ts` sourced from the packs

`catalog.ts` imports the fourteen packs and builds `allTemplates` from them.
Every export keeps its exact signature and stays synchronous: `listSubjects`,
`listLevels`, `templatesFor`, `topicsForLevel`, `levelsForTopic`,
`subjectOverview`. **All eleven call sites are untouched**, and no screen gains a
failure mode.

The consequence worth stating: `src/content/catalog.test.ts` and
`src/content/english/leaks.test.ts` import through `catalog.ts`, so they come to
validate **the shipped artifact** rather than its source, with no edit to either
file. The figure-anchoring draws, the option-set leak measurement, the
prompt-length sweep, the typed-answer bands and the four syllabus rules all move
onto the pack for free.

**The JSON import may not carry an attribute.** Written as

```ts
import maths3 from './packs/maths.3.json' with { type: 'json' };
```

it typechecks under the web's config and builds under Turbopack, tsx, vitest and
esbuild - and **fails the API's typecheck** with `TS2856: Import attributes are
not allowed on statements that compile to CommonJS 'require' calls`. Under the
API's `nodenext` resolution the file's real path is `src/content/catalog.ts`, so
the nearest `package.json` is the repository root, which declares no `"type"`;
`packages/core`'s `"type": "module"` never applies, because the symlink resolves
away from it before the lookup happens. The plain form passes everywhere - web
`tsc`, API `tsc`, `next build` under Turbopack, the esbuild bundle and vitest,
all confirmed by running them. So the attribute is banned here, which is worth
writing down because it is what a reader would reflexively add back.

## The endpoints

`apps/api/src/routes/content.ts`, registered in `server.ts` beside the other
seven. A plugin, because `@fastify/swagger` only sees routes inside one, and
these two must reach the contract or the Swift models cannot be generated from
them.

```
GET /content/manifest           -> manifest, ETag: "<version>", 304 on match
GET /content/{subject}/{level}  -> pack,     ETag: "<etag>",    304 on match
```

**Public falls out of the existing design rather than needing an exemption.**
`authPlugin` resolves the session on every request, but authorisation is
per-route through `requireUser`/`requireParent` - so a public route is one that
does not call them, exactly as `GET /shares/:token` already is.

`level` goes through `parseYearLevel`, which normalises `k` and `03` and refuses
anything else; `subject` is checked against the manifest's own subjects. Either
miss is a 404. Both files are served out of the esbuild bundle, which inlines an
imported JSON file - so there is no runtime path to resolve and the Docker build
context question never arises.

## The schema, and the hazard it carries

`apps/api/src/schemas/dto.ts` gains `questionTemplateSchema`, and under it
`varSpecSchema` (four arms), `choiceSpecSchema` and `figureSpecSchema` (eleven
arms on `kind`). This is the bulk of the work. `packages/core` needs
`./templates/types` added to its exports; only `figures/types` is exported today.

**This is "a response schema is a serializer" at its most dangerous.** A zod
object strips what it does not declare, so leaving `rightAngles` off the polygon
arm does not fail - every polygon question reaches iOS without its right-angle
ticks. Leaving `constraints` off the template compiles clean and ships questions
that violate their own bounds. It is the `figure`-vanishing-from-a-report
finding again, one layer deeper, with a second engine downstream that will
faithfully reproduce whatever it receives.

Three guards, in increasing strength:

1. **`Mirrored`** holds `questionTemplateSchema` and `choiceSpecSchema` to their
   DTOs by key set, both ways, as every other schema is held.
2. **`MirroredUnions`** takes `VarSpec` and `FigureSpec`. That machinery exists
   already for `Mark` and `Mode` and is exactly right here: `keyof` a union sees
   only the common keys, so a dropped arm would otherwise pass.
3. **A total round-trip test.** Every one of the 505 templates through the
   response schema, deep-equal against the pack. Not a sample - the whole
   corpus, which reaches all eleven figure kinds and all four var kinds. The
   test asserts that coverage explicitly, so the guard cannot quietly stop
   covering a variant as content changes.

Sending the committed bytes raw, with the schema declared for documentation
only, was considered. It makes stripping structurally impossible, and it trades
a checked hazard for an unchecked one: nothing would hold the contract to what
the wire carries, and the contract is what iOS generates from. Rejected in
favour of the round-trip guard.

## Testing

| Test | What it holds |
| --- | --- |
| `src/content/packs.test.ts` (new) | Regenerates in memory from the TS literals and asserts byte-equality against every committed pack and the manifest. Editing a year file without running the build goes red; so does hand-editing a pack. |
| `src/content/catalog.test.ts` | Unchanged, now over the packs: ids, tags, syllabus rules, figure anchoring, prompt length, typed-answer bands. |
| `src/content/english/leaks.test.ts` | Unchanged, now over the packs. |
| `apps/api/test/routes/content.test.ts` (new) | The two endpoints: 200s, ETag, 304 on a matching `If-None-Match`, 404 on an unknown subject and on an unparseable level, and no session required. |
| `apps/api/test/schemas/content.test.ts` (new) | The total round-trip: all 505 templates through `questionTemplateSchema`, deep-equal, plus the kind-coverage assertion. |

`npm run contract --workspace apps/api` regenerates `openapi.yaml` from 30 paths
to 32.

## Out of scope

- **Fixture generation** - build-order step 3, its own spec.
- **Any Swift work** - step 4, and in the other repository.
- **Database- or blob-stored content**, and the upload path that implies.
- **A runtime content refresh in the web app.** The bundled packs are what the
  web renders, full stop.

## Open questions

None blocking. One to settle when iOS gets there: the refresh cadence for the
bundled copy - on launch, daily, or only on a manifest change. The `ETag` makes
any of the three cheap, and the choice belongs to the client rather than to this
format.
