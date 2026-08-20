import type { QuestionTemplate } from '@/lib/templates/types';
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
 * Content is written against the Australian Curriculum v9.0 (ACARA), using the
 * official "Mathematics scope and sequence F-10" as the source. Every template
 * carries the content description code it practises in `tags` - e.g.
 * `AC9M4N02`, "explain and use the properties of odd and even numbers" - so the
 * mapping from curriculum to question is checkable rather than asserted. The
 * codes read as AC9 M <year> <strand> <number>, where the strands are N number,
 * A algebra, M measurement, SP space, ST statistics and P probability.
 *
 * Note how topics recur across years rather than belonging to one: "counting
 * numbers" runs from K into Year 1, "fractions" from Year 2 into Year 6, and so
 * on. The year says how hard; the topic says what skill.
 *
 * Two rules every template here obeys:
 *
 * - **A question may be a picture, and the picture is generated.** The shape,
 *   symmetry and angle questions carry a `figure` (see `src/lib/figures`), built
 *   from the same bound scope and the same seeded `Rng` as the prompt around it.
 *   None of them pins a rotation: an answer that always drew the same diagram
 *   would teach the diagram, and `validateTemplate` fails a template that does.
 *   What still cannot be drawn - number lines, bar and picture graphs, clock
 *   faces - is left out rather than faked.
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
