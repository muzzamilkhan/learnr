import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allTemplates } from '../../src/content/catalog';
import { allSets, buildDigestFiles } from './digests';

const generated = buildDigestFiles(allSets(allTemplates));
const read = (name: string) => JSON.parse(generated.get(name)!);

describe('buildDigestFiles', () => {
  it('writes a file per subject and year, and a manifest', () => {
    expect([...generated.keys()]).toContain('maths.3.json');
    expect([...generated.keys()]).toContain('english.K.json');
    expect([...generated.keys()]).toContain('manifest.json');
  });

  it('carries the grading set', () => {
    expect([...generated.keys()]).toContain('grading.json');
  });

  it('carries the profile set', () => {
    expect([...generated.keys()]).toContain('profile.json');
  });

  it('holds one group per template, hashed', () => {
    const file = read('maths.3.json');
    const ids = allTemplates.filter((t) => t.subject === 'maths' && t.level === '3').map((t) => t.id);
    expect(Object.keys(file.groups).sort()).toEqual([...ids].sort());
    for (const hash of Object.values(file.groups)) expect(hash).toMatch(/^[0-9a-f]{12}$/);
  });

  it('derives a version from its own body, so identical content hashes the same', () => {
    expect(read('maths.3.json').version).toBe(
      JSON.parse(buildDigestFiles(allSets(allTemplates)).get('maths.3.json')!).version,
    );
    expect(read('maths.3.json').version).toMatch(/^[0-9a-f]{12}$/);
  });

  it('moves the version of the set that changed, and of no other', () => {
    const edited = [...allTemplates];
    const index = edited.findIndex((t) => t.subject === 'maths' && t.level === '3');
    edited[index] = { ...edited[index], prompt: `${edited[index].prompt} ` };

    const after = buildDigestFiles(allSets(edited));
    const versionOf = (files: Map<string, string>, name: string) =>
      JSON.parse(files.get(name)!).version;

    expect(versionOf(after, 'maths.3.json')).not.toBe(versionOf(generated, 'maths.3.json'));
    expect(versionOf(after, 'maths.4.json')).toBe(versionOf(generated, 'maths.4.json'));
    // The manifest hashes the set hashes, so it moves whenever any set does.
    expect(versionOf(after, 'manifest.json')).not.toBe(versionOf(generated, 'manifest.json'));
  });

  it('ends every file with a newline and indents at two spaces', () => {
    for (const body of generated.values()) {
      expect(body.endsWith('\n')).toBe(true);
      expect(body).toContain('\n  "version"');
    }
  });

  it('carries the expression set beside the corpus years', () => {
    expect([...generated.keys()]).toContain('expr.json');
    expect(Object.keys(read('expr.json').groups)).toContain('traps');
  });
});

const digestDir = join(import.meta.dirname, '..', '..', 'fixtures', 'digests');

describe('the committed digests', () => {
  it('are exactly the files the generator writes', () => {
    expect(readdirSync(digestDir).filter((n) => n.endsWith('.json')).sort()).toEqual(
      [...generated.keys()].sort(),
    );
  });

  it.each([...generated.keys()])('%s is byte-identical to what the engine generates', (name) => {
    expect(readFileSync(join(digestDir, name), 'utf8')).toBe(generated.get(name));
  });
});
