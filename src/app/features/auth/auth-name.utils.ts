/**
 * Uniforma nome e cognome come vengono mostrati nel profilo. Gli apostrofi e i
 * trattini aprono una nuova parola, quindi anche D'Angelo e Anna-Maria restano
 * leggibili.
 */
export function toPersonNameCase(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('it-IT')
    .replace(/(^|[\s'’.-])(\p{L})/gu, (_, separator: string, letter: string) =>
      separator + letter.toLocaleUpperCase('it-IT'));
}
