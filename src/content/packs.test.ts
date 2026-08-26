import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPacks, CORPUS } from '../../scripts/content-packs';
import type { ContentManifest, ContentPack } from '../lib/dto';

const generated = buildPacks(CORPUS);
const read = <T>(name: string): T => JSON.parse(generated.get(name)!) as T;

describe('buildPacks', () => {
  it('writes a pack per subject and year, and a manifest', () => {
    expect([...generated.keys()].sort()).toEqual(
      [
        'english.1.json', 'english.2.json', 'english.3.json', 'english.4.json',
        'english.5.json', 'english.6.json', 'english.K.json', 'manifest.json',
        'maths.1.json', 'maths.2.json', 'maths.3.json', 'maths.4.json',
        'maths.5.json', 'maths.6.json', 'maths.K.json',
      ].sort(),
    );
  });

  it('names each pack inside itself', () => {
    const pack = read<ContentPack>('maths.3.json');
    expect(pack.subject).toBe('maths');
    expect(pack.level).toBe('3');
    expect(pack.templates.every((t) => t.subject === 'maths' && t.level === '3')).toBe(true);
  });

  it('holds every template exactly once, in the catalog order', () => {
    const packed = [
      'maths.K.json', 'maths.1.json', 'maths.2.json', 'maths.3.json',
      'maths.4.json', 'maths.5.json', 'maths.6.json',
      'english.K.json', 'english.1.json', 'english.2.json', 'english.3.json',
      'english.4.json', 'english.5.json', 'english.6.json',
    ].flatMap((name) => read<ContentPack>(name).templates);

    expect(packed.map((t) => t.id)).toEqual(CORPUS.map((t) => t.id));
  });

  it('derives a version from the pack, so identical content hashes the same', () => {
    const pack = read<ContentPack>('maths.3.json');
    const again = buildPacks(CORPUS);
    expect(JSON.parse(again.get('maths.3.json')!).version).toBe(pack.version);
    expect(pack.version).toMatch(/^[0-9a-f]{12}$/);
  });

  it('moves the version of the pack that changed, and of no other', () => {
    const edited = [...CORPUS];
    const index = edited.findIndex((t) => t.subject === 'maths' && t.level === '3');
    edited[index] = { ...edited[index], prompt: `${edited[index].prompt} ` };

    const after = buildPacks(edited);
    const versionOf = (files: Map<string, string>, name: string): string =>
      JSON.parse(files.get(name)!).version;

    expect(versionOf(after, 'maths.3.json')).not.toBe(versionOf(generated, 'maths.3.json'));
    expect(versionOf(after, 'maths.4.json')).toBe(versionOf(generated, 'maths.4.json'));
    // The manifest hashes the pack hashes, so it moves whenever any pack does.
    expect(versionOf(after, 'manifest.json')).not.toBe(versionOf(generated, 'manifest.json'));
  });

  it('carries the topics and counts a client needs before downloading a pack', () => {
    const manifest = read<ContentManifest>('manifest.json');
    expect(manifest.subjects.map((s) => s.subject)).toEqual(['english', 'maths']);

    const maths = manifest.subjects.find((s) => s.subject === 'maths')!;
    expect(maths.levels.map((l) => l.level)).toEqual(['K', '1', '2', '3', '4', '5', '6']);

    const year3 = maths.levels.find((l) => l.level === '3')!;
    expect(year3.templateCount).toBe(read<ContentPack>('maths.3.json').templates.length);
    expect(year3.etag).toBe(read<ContentPack>('maths.3.json').version);
    expect(year3.topics).toEqual([...year3.topics].sort());
  });

  it('ends every file with a newline and indents at two spaces', () => {
    for (const body of generated.values()) {
      expect(body.endsWith('\n')).toBe(true);
      expect(body).toContain('\n  "version"');
    }
  });
});

const packDir = join(import.meta.dirname, 'packs');

describe('the committed packs', () => {
  it('are exactly the files the generator writes', () => {
    const onDisk = readdirSync(packDir).filter((name) => name.endsWith('.json'));
    expect(onDisk.sort()).toEqual([...generated.keys()].sort());
  });

  it.each([...generated.keys()])('%s is byte-identical to what the templates generate', (name) => {
    expect(readFileSync(join(packDir, name), 'utf8')).toBe(generated.get(name));
  });
});
