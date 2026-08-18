import { describe, expect, it } from 'vitest';
import type { Question } from '../templates/types';
import { questionNarration, spokenText } from './narration';

function question(over: Partial<Question> = {}): Question {
  return {
    templateId: 'maths.1.addition.sum',
    subject: 'maths',
    topic: 'addition',
    level: '1',
    prompt: 'What is 4 + 5?',
    answer: 9,
    answerType: 'number',
    vars: {},
    ...over,
  };
}

describe('spokenText', () => {
  it('says the arithmetic symbols as words', () => {
    expect(spokenText('What is 4 + 5?')).toBe('What is 4 plus 5?');
    expect(spokenText('What is 9 − 5?')).toBe('What is 9 minus 5?');
    expect(spokenText('What is 3 × 4?')).toBe('What is 3 times 4?');
    expect(spokenText('What is 12 ÷ 4?')).toBe('What is 12 divided by 4?');
    expect(spokenText('4 + 5 = 9')).toBe('4 plus 5 equals 9');
  });

  it('says a spaced hyphen as minus, and leaves one inside a word alone', () => {
    expect(spokenText('What is 9 - 5?')).toBe('What is 9 minus 5?');
    expect(spokenText('Is it two-thirds?')).toBe('Is it two-thirds?');
  });

  it('reads a slash between numbers as the fraction it is', () => {
    expect(spokenText('Write 1/4 as a decimal.')).toBe('Write 1 out of 4 as a decimal.');
    expect(spokenText('What is 2/3 of 12?')).toBe('What is 2 out of 3 of 12?');
  });

  it('says percent and degrees', () => {
    expect(spokenText('What is 50% of 20?')).toBe('What is 50 percent of 20?');
    expect(spokenText('The temperature is 8°C. What is it in °C?')).toBe(
      'The temperature is 8 degrees. What is it in degrees?',
    );
  });

  it('moves a dollar sign behind the amount it leads', () => {
    expect(spokenText('You have $5.')).toBe('You have 5 dollars.');
    expect(spokenText('It costs $2.50 today.')).toBe('It costs 2.50 dollars today.');
    expect(spokenText('You have $1 left.')).toBe('You have 1 dollar left.');
  });

  it('says a c after an amount as cents', () => {
    expect(spokenText('How many 50c coins make $3?')).toBe(
      'How many 50 cent coins make 3 dollars?',
    );
    expect(spokenText('A sticker costs 20c.')).toBe('A sticker costs 20 cents.');
  });

  it('says an amount describing a coin in the singular', () => {
    expect(spokenText('You pay with a $2 coin.')).toBe('You pay with a 2 dollar coin.');
  });

  it('says brackets, which are the whole point of the question that has them', () => {
    expect(spokenText('What is (4 + 5) × 3?')).toBe(
      'What is open bracket 4 plus 5 close bracket times 3?',
    );
  });

  it('says the abbreviated units in full', () => {
    expect(spokenText('A rectangle is 10 cm long and 3 cm wide.')).toBe(
      'A rectangle is 10 centimetres long and 3 centimetres wide.',
    );
    expect(spokenText('A rectangle is 6 m long.')).toBe('A rectangle is 6 metres long.');
  });

  it('says a standalone question mark as the gap it stands for', () => {
    expect(spokenText('Fill in the gap: 12, 13, ?, 15')).toBe('Fill in the gap: 12, 13, what, 15');
    expect(spokenText('What goes in the box? 4 + ? = 9')).toBe(
      'What goes in the box? 4 plus what equals 9',
    );
    expect(spokenText('Complete: 2/3 = ?/9')).toBe('Complete: 2 out of 3 equals what out of 9');
  });

  it('leaves the sentence its own question mark', () => {
    expect(spokenText('What number comes after 7?')).toBe('What number comes after 7?');
  });

  it('collapses the whitespace its substitutions leave behind', () => {
    expect(spokenText('  4  +  5  ')).toBe('4 plus 5');
  });
});

describe('questionNarration', () => {
  it('is the prompt for a typed question', () => {
    expect(questionNarration(question())).toBe('What is 4 plus 5?');
  });

  it('leaves numeric options unsaid', () => {
    const q = question({
      answerType: 'choice',
      choices: [8, 9, 10],
      answer: 9,
    });
    expect(questionNarration(q)).toBe('What is 4 plus 5?');
  });

  it('reads word options out, since they are why the question is multiple choice', () => {
    const q = question({
      prompt: 'A shape has 3 equal sides. What is it called?',
      answerType: 'choice',
      choices: ['triangle', 'square', 'circle'],
      answer: 'triangle',
    });
    expect(questionNarration(q)).toBe(
      'A shape has 3 equal sides. What is it called? Is it triangle, square, or circle?',
    );
  });

  it('reads a pair of word options with no comma', () => {
    const q = question({
      prompt: 'Would you measure a pencil with a ruler or a tape measure?',
      answerType: 'choice',
      choices: ['metres', 'centimetres'],
      answer: 'centimetres',
    });
    expect(questionNarration(q)).toBe(
      'Would you measure a pencil with a ruler or a tape measure? Is it metres or centimetres?',
    );
  });

  it('leaves the options unsaid when the prompt has already named them all', () => {
    const q = question({
      prompt: 'Which ribbon is longer, red or blue?',
      answerType: 'choice',
      choices: ['red', 'blue'],
      answer: 'red',
    });
    expect(questionNarration(q)).toBe('Which ribbon is longer, red or blue?');
  });

  it('ends the prompt before the options when the prompt ended in the gap', () => {
    const q = question({
      prompt: 'What comes next? red, blue, red, blue, ?',
      answerType: 'choice',
      choices: ['red', 'blue', 'green'],
      answer: 'red',
    });
    expect(questionNarration(q)).toBe(
      'What comes next? red, blue, red, blue, what. Is it red, blue, or green?',
    );
  });

  it('leaves negative options unsaid, being numbers with a symbol in front', () => {
    const q = question({
      prompt: 'What is 3 − 8?',
      answerType: 'choice',
      choices: ['−5', '5', '−11'],
      answer: '−5',
    });
    expect(questionNarration(q)).toBe('What is 3 minus 8?');
  });

  it('says nothing extra for true or false, whose buttons are those two words every time', () => {
    const q = question({
      prompt: 'True or false: 7 is more than 5.',
      answerType: 'boolean',
      answer: true,
    });
    expect(questionNarration(q)).toBe('True or false: 7 is more than 5.');
  });
});
