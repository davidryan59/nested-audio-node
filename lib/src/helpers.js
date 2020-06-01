import isObject from 'is-object';
import isArray from 'isarray';

export const doNothing = () => {};

export const isArrayOrObject = (val) => isArray(val) || isObject(val);

export const isArrayIndex = (val) => Number.isInteger(val) && val >= 0;

export const arrayIndexPopulated = (array, idx) => isArray(array) && array[idx] != null;

export const disp = (val) => JSON.stringify(val);

// Does this item implement the Web Audio API for a-rate (or k-rate) parameters?
// Use setValueAtTime as the marker for this API...
export const isAudioParam = (item) => !!(item && item.setValueAtTime && item.setValueAtTime.call);

export const makeConstObj = (node, key, value) => ({ node, key, value });
