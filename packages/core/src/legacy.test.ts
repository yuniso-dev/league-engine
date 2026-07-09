import { describe, expect, test } from 'vitest';
import { parseLegacyArchive } from './legacy';

const SAMPLE = `**# <:Gold:1340750816872501291> Frontier Awards History <:Gold:1340750816872501291>**
‎
> __**## Frontier I**__
> 🏆 ***Winners:*** <@1080048644453052447>, <@379345273098338304>, <@1193225173801893919>, <@1143915351134978049>
> ⚽ ***Golden Boot:*** N/A
> 🧱 ***Wallside:*** N/A
> 👟 ***Sharp's:*** N/A
> ❄️ ***Xavier Frost:*** N/A


> __**## Frontier IV**__
> 🏆 ***Winners:*** <@379345273098338304>, <@395458013571448832>
> ⚽ ***Golden Boot:*** <@693840118754181241>
> 🧱 ***Wallside:*** N/A
> 👟 ***Sharp's:*** <@679619562161176577>
> ❄️ ***Xavier Frost:*** N/A


> __**# Frontier VI**__
> 🏆 ***Winners:*** <@464039921871618068>﻿, <@1429432378849230960>
> ⚽ ***Golden Boot:*** N/A
> 🧱 ***Wallside:*** <@1208424146124668938>
> 👟 ***Sharp's:*** <@824029036917424239>, <@1123347238022807604>
> ❄️ ***Xavier Frost:*** N/A`;

describe('parseLegacyArchive', () => {
  const editions = parseLegacyArchive(SAMPLE);

  test('reads each edition header, skipping the title line', () => {
    expect(editions.map(e => e.edition)).toEqual([1, 4, 6]);
    expect(editions.map(e => e.label)).toEqual(['Frontier I', 'Frontier IV', 'Frontier VI']);
  });

  test('champions are captured for every edition', () => {
    const champs = (n: number) =>
      editions.find(e => e.edition === n)!.winners.filter(w => w.category === 'champion').map(w => w.discordId);
    expect(champs(1)).toEqual([
      '1080048644453052447', '379345273098338304', '1193225173801893919', '1143915351134978049',
    ]);
    expect(champs(4)).toEqual(['379345273098338304', '395458013571448832']);
  });

  test('individual honours map to the right category', () => {
    const e4 = editions.find(e => e.edition === 4)!;
    expect(e4.winners.filter(w => w.category === 'golden_boot').map(w => w.discordId)).toEqual(['693840118754181241']);
    expect(e4.winners.filter(w => w.category === 'sharps').map(w => w.discordId)).toEqual(['679619562161176577']);
    const e6 = editions.find(e => e.edition === 6)!;
    expect(e6.winners.filter(w => w.category === 'wallside').map(w => w.discordId)).toEqual(['1208424146124668938']);
    expect(e6.winners.filter(w => w.category === 'sharps').map(w => w.discordId)).toEqual([
      '824029036917424239', '1123347238022807604',
    ]);
  });

  test('N/A honours produce no winners', () => {
    const e1 = editions.find(e => e.edition === 1)!;
    expect(e1.winners.every(w => w.category === 'champion')).toBe(true);
    expect(e1.winners).toHaveLength(4);
  });

  test('duplicate mentions within a line are de-duplicated', () => {
    const dup = parseLegacyArchive(
      '## Frontier II\n🏆 Winners: <@111>, <@222>, <@111>',
    );
    expect(dup[0].winners.map(w => w.discordId)).toEqual(['111', '222']);
  });

  test('empty / junk input yields no editions', () => {
    expect(parseLegacyArchive('')).toEqual([]);
    expect(parseLegacyArchive('just some text with <@123> but no edition header')).toEqual([]);
  });
});
