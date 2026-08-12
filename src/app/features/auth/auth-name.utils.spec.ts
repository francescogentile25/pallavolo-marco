import { toPersonNameCase } from './auth-name.utils';

describe('toPersonNameCase', () => {
  it('normalizes lowercase and uppercase names', () => {
    expect(toPersonNameCase('  francesco   GENTILE ')).toBe('Francesco Gentile');
  });

  it('capitalizes names after apostrophes and hyphens', () => {
    expect(toPersonNameCase("d'angelo")).toBe("D'Angelo");
    expect(toPersonNameCase('anna-maria')).toBe('Anna-Maria');
  });
});
