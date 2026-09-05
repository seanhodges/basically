import { describe, expect, it } from 'vitest';
import {
  composeAiProfile,
  LINE_NUMBER_RULES,
  REPLY_RULE,
} from './aiProfileComposer';
import { dialects } from '../dialects/registry';

describe('composeAiProfile', () => {
  it('lays the intro, sections and OUTPUT FORMAT out one blank line apart', () => {
    const { systemPrompt } = composeAiProfile({
      intro: 'You are an expert.',
      sections: [
        { heading: 'WRITING FOR THIS MACHINE', bullets: ['Slow.', 'Small.'] },
      ],
      lineNumberRule: 'standard',
    });
    expect(systemPrompt).toBe(
      [
        'You are an expert.',
        '',
        'WRITING FOR THIS MACHINE',
        '- Slow.',
        '- Small.',
        '',
        'OUTPUT FORMAT',
        `- ${LINE_NUMBER_RULES.standard}`,
        `- ${REPLY_RULE}`,
      ].join('\n'),
    );
  });

  it('takes the line-number wording the dialect names', () => {
    const bbc = composeAiProfile({
      intro: 'i',
      sections: [],
      lineNumberRule: 'bbc',
    });
    expect(bbc.systemPrompt).toContain('LIST/LISTO');
    expect(bbc.systemPrompt).not.toContain(LINE_NUMBER_RULES.standard);
  });

  it('replaces the closing bullets when the dialect supplies its own', () => {
    const { systemPrompt } = composeAiProfile({
      intro: 'i',
      sections: [],
      lineNumberRule: 'standard',
      outputFormat: [REPLY_RULE, 'Target 48K.'],
    });
    expect(systemPrompt.split('\n').slice(-2)).toEqual([
      `- ${REPLY_RULE}`,
      '- Target 48K.',
    ]);
  });
});

describe('every registered dialect', () => {
  it('opens with an expert line and closes with the OUTPUT FORMAT block', () => {
    for (const dialect of dialects) {
      const prompt = dialect.aiProfile.systemPrompt;
      expect(prompt.startsWith('You are an expert '), dialect.id).toBe(true);
      expect(prompt, dialect.id).toContain('\n\nOUTPUT FORMAT\n');
      expect(
        Object.values(LINE_NUMBER_RULES).some((rule) => prompt.includes(rule)),
        `${dialect.id} states the line-number rule its own way`,
      ).toBe(true);
    }
  });

  it('writes every bullet flush-left under its heading', () => {
    for (const dialect of dialects) {
      for (const line of dialect.aiProfile.systemPrompt.split('\n')) {
        expect(line.startsWith(' '), `${dialect.id}: "${line}"`).toBe(false);
      }
    }
  });
});
