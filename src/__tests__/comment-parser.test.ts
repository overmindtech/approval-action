import {
  findOvermindComment,
  parseOvermindComment,
  extractChangeUrl
} from '../comment-parser';
import * as fs from 'fs';
import * as path from 'path';

describe('comment-parser', () => {
  const fixturesDir = path.join(__dirname, '../__fixtures__');

  describe('findOvermindComment', () => {
    it('should find Overmind comment by signature', () => {
      const comments = [
        { body: 'Some random comment' },
        { body: 'Open in Overmind ↗\n\n🔥 Risks\n\nSome risks here' },
        { body: 'Another comment' }
      ];

      const result = findOvermindComment(comments);
      expect(result).toBeTruthy();
      expect(result).toContain('Open in Overmind ↗');
      expect(result).toContain('🔥 Risks');
    });

    it('should return null if no Overmind comment found', () => {
      const comments = [
        { body: 'Some random comment' },
        { body: 'Another comment' }
      ];

      const result = findOvermindComment(comments);
      expect(result).toBeNull();
    });

    it('should handle null/undefined comment bodies', () => {
      const comments = [
        { body: null },
        { body: undefined },
        { body: 'Open in Overmind ↗\n\n🔥 Risks' }
      ];

      const result = findOvermindComment(comments);
      expect(result).toBeTruthy();
    });
  });

  describe('extractChangeUrl', () => {
    it('should extract change URL from comment', () => {
      const comment = 'https://app.overmind.tech/changes/df4c4cb0-beef-48b2-9917-9ea4b534126f';
      const url = extractChangeUrl(comment);
      expect(url).toBe('https://app.overmind.tech/changes/df4c4cb0-beef-48b2-9917-9ea4b534126f');
    });

    it('should return empty string if no URL found', () => {
      const comment = 'No URL here';
      const url = extractChangeUrl(comment);
      expect(url).toBe('');
    });
  });

  describe('parseOvermindComment', () => {
    it('should parse sample Overmind comment', () => {
      const comment = fs.readFileSync(
        path.join(fixturesDir, 'sample-overmind-comment.md'),
        'utf-8'
      );

      const parsed = parseOvermindComment(comment);

      expect(parsed).toBeTruthy();
      expect(parsed?.signals).toHaveLength(1);
      expect(parsed?.signals[0].category).toBe('Routine');
      expect(parsed?.signals[0].emoji).toBe('🔴');
      expect(parsed?.signals[0].severity).toBe(-5); // 🔴 (-1) × 5 bars = -5

      expect(parsed?.risks).toHaveLength(2);
      expect(parsed?.risks[0].severity).toBe('high');
      expect(parsed?.risks[1].severity).toBe('medium');

      expect(parsed?.blastRadius.items).toBe(19);
      expect(parsed?.blastRadius.edges).toBe(84);

      expect(parsed?.changeUrl).toContain('df4c4cb0-beef-48b2-9917-9ea4b534126f');
    });

    it('should parse safe comment with green signal', () => {
      const comment = fs.readFileSync(
        path.join(fixturesDir, 'safe-comment.md'),
        'utf-8'
      );

      const parsed = parseOvermindComment(comment);

      expect(parsed).toBeTruthy();
      expect(parsed?.signals).toHaveLength(1);
      expect(parsed?.signals[0].emoji).toBe('🟢');
      expect(parsed?.signals[0].severity).toBe(5); // 🟢 (+1) × 5 bars = +5

      expect(parsed?.risks).toHaveLength(0);

      expect(parsed?.blastRadius.items).toBe(2);
      expect(parsed?.blastRadius.edges).toBe(1);
    });

    it('should parse high risk comment', () => {
      const comment = fs.readFileSync(
        path.join(fixturesDir, 'high-risk-comment.md'),
        'utf-8'
      );

      const parsed = parseOvermindComment(comment);

      expect(parsed).toBeTruthy();
      expect(parsed?.risks.filter(r => r.severity === 'high')).toHaveLength(2);
      expect(parsed?.risks.filter(r => r.severity === 'medium')).toHaveLength(0);
    });

    it('should parse policy violation comment', () => {
      const comment = fs.readFileSync(
        path.join(fixturesDir, 'policy-violation-comment.md'),
        'utf-8'
      );

      const parsed = parseOvermindComment(comment);

      expect(parsed).toBeTruthy();
      expect(parsed?.signals.some(s => s.category.toLowerCase().includes('policies'))).toBe(true);
      expect(parsed?.risks.filter(r => r.severity === 'medium')).toHaveLength(1);
    });

    it('should handle empty comment', () => {
      const parsed = parseOvermindComment('');
      expect(parsed).toBeNull();
    });

    it('should handle malformed comment gracefully', () => {
      const malformed = 'Not a valid Overmind comment';
      const parsed = parseOvermindComment(malformed);
      // Should not throw, but may return empty arrays
      expect(parsed).toBeTruthy();
      expect(parsed?.signals).toEqual([]);
      expect(parsed?.risks).toEqual([]);
    });

    it('should parse signal severity correctly', () => {
      // Test various emoji and bar combinations
      const testCases = [
        { emoji: '🔴', bars: '▇▅▃▂▁', expected: -5 },
        { emoji: '🟢', bars: '▇▅▃▂▁', expected: 5 },
        { emoji: '⚪', bars: '▇▅▃▂▁', expected: 0 },
        { emoji: '🔴', bars: '▇▅', expected: -2 },
        { emoji: '🟢', bars: '▇', expected: 1 }
      ];

      testCases.forEach(({ emoji, bars, expected }) => {
        const comment = `**Test** ${emoji} \`${bars}\` Description`;
        const parsed = parseOvermindComment(comment);
        expect(parsed?.signals[0]?.severity).toBe(expected);
      });
    });

    it('should parse multiple signals', () => {
      const comment = `
**Routine** 🔴 \`▇▅▃\` Routine description

**Cost** 🟢 \`▇▇\` Cost description

**Policies** ⚪ \`▇\` Policy description
      `;

      const parsed = parseOvermindComment(comment);
      expect(parsed?.signals).toHaveLength(3);
      expect(parsed?.signals[0].severity).toBe(-3);
      expect(parsed?.signals[1].severity).toBe(2);
      expect(parsed?.signals[2].severity).toBe(0);
    });
  });
});

