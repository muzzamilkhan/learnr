import type { QuestionTemplate } from '@/lib/templates/types';
import { yearK } from './k';

/**
 * English course, Kindergarten to Year 6.
 *
 * Written against two syllabuses like the maths course beside it: ACARA's
 * Australian Curriculum v9.0 English, and the NSW English K-10 Syllabus (2022).
 * An ACARA English code reads AC9 E <year> <strand> <number>, where the strands
 * are LA Language, LE Literature and LY Literacy - three, where maths has six.
 * An NSW English code reads EN <stage> - <focus area> - <number>. NSW outcome
 * statements are Crown copyright and are never reproduced here.
 *
 * Three rules every template here obeys, and the last is the one that is easy
 * to get wrong:
 *
 * - **No question is a picture.** Word and sentence level work needs no
 *   diagram, and the kind that might have been invented for it - a drawn object
 *   to name - fights the anchoring rule hardest of anything in the app: a drawn
 *   cat is one picture, so "cat" would be anchored to it by construction.
 * - **A child is never asked to type something the screen cannot express.** The
 *   letter pad has no space key and no apostrophe key, so every typed answer is
 *   one word of A-Z, and contractions and possessives are multiple choice -
 *   the same rule that makes the Year 6 integer questions choice because the
 *   number pad has no minus key. Kindergarten types nothing at all.
 * - **A template has one word bank, and every word in it is sometimes the
 *   answer and sometimes a distractor.** English is made of closed word lists,
 *   which is the exact shape `validateTemplate`'s closed-set check refuses -
 *   and refuses rightly, because a child can pick the odd one out without
 *   knowing what a rhyme is. Draw the *family* first, then the target from it,
 *   then the answer from the same family and the distractors from other
 *   families, so `hat` is the answer when the target is `cat` and a distractor
 *   when the target is `dog`.
 */
export const englishTemplates: QuestionTemplate[] = [...yearK];
