// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import {TextDecoder, TextEncoder} from 'util';

// react-router v7 uses TextEncoder, which CRA's jsdom environment does not provide
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// No test talks to a backend: axios is replaced by mocks each test sets up (see test-fixtures.js).
// This also keeps jest from having to load axios, which ships as an ES module CRA's jest won't
// transform.
jest.mock('axios', () => {
  const axios = jest.fn();
  axios.get = jest.fn();
  axios.post = jest.fn();
  return {__esModule: true, default: axios};
});

// jsdom has neither a canvas for vis-network nor wasm for RDKit, so both are stubbed out - the
// tests are about what the app does with the API, not about drawing graphs and molecules. Plain
// functions rather than jest.fn(): CRA resets mock implementations before every test.
jest.mock('vis-network', () => ({
  // a network that accepts every call: methods return a no-op that itself returns a number, which
  // is all the app reads back (e.g. getScale())
  Network: function Network() {
    return new Proxy({}, {get: () => () => 1});
  },
}));
jest.mock('./lib/rdkit-loader', () => ({
  // never resolves, so the structure drawings stay in their loading state
  loadRDKit: () => new Promise(() => {}),
}));
