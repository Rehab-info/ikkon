import { describe, expect, it } from 'vitest';
import { UnknownValueFormatError, parseSfctValue } from './value.ts';

describe('parseSfctValue', () => {
  it.each([
    [12.7, 'measured', 12.7],
    [343, 'measured', 343],
    ['6.0', 'measured', 6],
    ['0', 'measured', 0],
    [0, 'measured', 0],
    ['(9.7)', 'estimated', 9.7],
    ['(0)', 'estimated', 0],
    ['Tr', 'trace', 0],
    ['(Tr)', 'estimated_trace', 0],
    ['-', 'not_determined', null],
    [' Tr ', 'trace', 0],
  ] as const)('%j → %s %s', (raw, kind, value) => {
    expect(parseSfctValue(raw)).toMatchObject({ kind, value });
  });

  it.each([
    null,
    undefined,
    '',
    'abc',
    '1,2',
    '-1',
    -1,
    '(Tr',
    '*',
    '12.7*',
    Number.NaN,
    Number.POSITIVE_INFINITY,
    '１２',
  ])('想定外の書き方 %j は 0 にせず例外', (raw) => {
    expect(() => parseSfctValue(raw)).toThrow(UnknownValueFormatError);
  });
});
