import {
  doNothing, isArrayOrObject, isArrayIndex, disp, arrayIndexPopulated, isAudioParam,
} from '../src/helpers';


test('', () => { expect(doNothing('any input')).toBeUndefined(); });


test('', () => { expect(isArrayOrObject()).toBeFalsy(); });
test('', () => { expect(isArrayOrObject(42.0001)).toBeFalsy(); });
test('', () => { expect(isArrayOrObject('string')).toBeFalsy(); });
test('', () => { expect(isArrayOrObject(() => 'a function')).toBeFalsy(); });

test('', () => { expect(isArrayOrObject([])).toBeTruthy(); });
test('', () => { expect(isArrayOrObject({})).toBeTruthy(); });
test('', () => { expect(isArrayOrObject([1, [2, 3]])).toBeTruthy(); });
test('', () => { expect(isArrayOrObject({ a: 1, b: 2 })).toBeTruthy(); });


test('', () => { expect(isArrayIndex()).toBeFalsy(); });
test('', () => { expect(isArrayIndex(-1)).toBeFalsy(); });
test('', () => { expect(isArrayIndex(1.0000001)).toBeFalsy(); });
test('', () => { expect(isArrayIndex('string')).toBeFalsy(); });
test('', () => { expect(isArrayIndex(() => 'function')).toBeFalsy(); });

test('', () => { expect(isArrayIndex(0)).toBeTruthy(); });
test('', () => { expect(isArrayIndex(1)).toBeTruthy(); });
test('', () => { expect(isArrayIndex(3000000)).toBeTruthy(); });


test('', () => { expect(arrayIndexPopulated()).toBeFalsy(); });
test('', () => { expect(arrayIndexPopulated([0, null, 2])).toBeFalsy(); });
test('', () => { expect(arrayIndexPopulated([0, null, 2], 'string')).toBeFalsy(); });
test('', () => { expect(arrayIndexPopulated([0, null, 2], -1)).toBeFalsy(); });
test('', () => { expect(arrayIndexPopulated([0, null, 2], 0)).toBeTruthy(); });
test('', () => { expect(arrayIndexPopulated([0, null, 2], 1)).toBeFalsy(); });
test('', () => { expect(arrayIndexPopulated([0, null, 2], 2)).toBeTruthy(); });


test('', () => { expect(disp({ a: 1, b: 2 })).toEqual('{"a":1,"b":2}'); });


test('', () => { expect(isAudioParam()).toBeFalsy(); });
test('', () => { expect(isAudioParam(4)).toBeFalsy(); });
test('', () => { expect(isAudioParam(-34.567)).toBeFalsy(); });
test('', () => { expect(isAudioParam('string')).toBeFalsy(); });
test('', () => { expect(isAudioParam([])).toBeFalsy(); });
test('', () => { expect(isAudioParam({})).toBeFalsy(); });
test('', () => { expect(isAudioParam(() => 'function')).toBeFalsy(); });

test('', () => {
  expect(isAudioParam({
    thisIsA: 'Mock Tone.js audio param',
    setValueAtTime: () => 'Param has function setValueAtTime',
  })).toBeTruthy();
});
