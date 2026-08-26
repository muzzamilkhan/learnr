import type { QuestionTemplate } from '../../lib/templates/types';
import { yearK } from './k';
import { year1 } from './1';
import { year2 } from './2';
import { year3 } from './3';
import { year4 } from './4';
import { year5 } from './5';
import { year6 } from './6';

/**
 * Maths course, Kindergarten to Year 6.
 *
 * Content is written against **two** syllabuses: the Australian Curriculum v9.0
 * (ACARA), from the official "Mathematics scope and sequence F-10", and the NSW
 * Mathematics K-10 Syllabus (2022). Every template carries in `tags` at least
 * one code for the content it practises - `AC9M4N02`, `MA2-AR-01` - so the
 * mapping from curriculum to question is checkable rather than asserted. Either
 * syllabus satisfies that on its own, because the two disagree about which year
 * some content belongs to and a template can honestly sit in only one of them;
 * `catalog.test.ts` names every such template, in both directions.
 *
 * An ACARA code reads AC9 M <year> <strand> <number>, where the strands are N
 * number, A algebra, M measurement, SP space, ST statistics and P probability.
 * An NSW code reads MA <stage> - <focus area> - <number>, and a stage spans two
 * school years (`stageForLevel`), which is why one Stage 2 code sits on both a
 * Year 3 and a Year 4 template. NSW outcome *statements* are Crown copyright
 * and are never reproduced here - the code is a reference, not a quotation.
 *
 * Note how topics recur across years rather than belonging to one: "counting
 * numbers" runs from K into Year 1, "fractions" from Year 2 into Year 6, and so
 * on. The year says how hard; the topic says what skill.
 *
 * Two rules every template here obeys:
 *
 * - **A question may be a picture, and the picture is generated.** Templates
 *   spanning fifteen of this course's topics carry a `figure` (see
 *   `src/lib/figures`) - not only the spatial ones, since data, chance and time
 *   are picture questions too - built from the same bound scope and the same
 *   seeded `Rng` as the prompt around it. None of them pins a rotation: an
 *   answer that always drew the same diagram would teach the diagram, and
 *   `validateTemplate` fails a template that does. `FIGURE_KINDS`
 *   is what can be drawn at all, and what a kind can be asked for is measured
 *   rather than assumed - see `docs/superpowers/notes/figure-content-notes.md`
 *   before authoring against one.
 * - **A child is never asked to type something the screen cannot express.** The
 *   number pad has no minus key, so the Year 6 integer questions are multiple
 *   choice. Decimal answers start at Year 4, where decimals enter the curriculum.
 *   For the same reason no question below Year 4 is answered with a typed word:
 *   spelling "triangle" is not the skill being tested, so those are multiple
 *   choice.
 *
 * Each school year lives in its own file (`k.ts`, `1.ts`, ... `6.ts`), and this
 * module concatenates them in school order - the order `mathsTemplates` has
 * always had.
 */
export const mathsTemplates: QuestionTemplate[] = [
  ...yearK,
  ...year1,
  ...year2,
  ...year3,
  ...year4,
  ...year5,
  ...year6,
];
