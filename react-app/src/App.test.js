import {render, screen} from '@testing-library/react';
import axios from 'axios';
import App from './App';
import {MODEL_INFO, mockBackend} from './test-fixtures';

beforeEach(() => {
  mockBackend(axios);
  window.history.pushState({}, '', '/');
});

test('renders the navigation', async () => {
  render(<App/>);
  expect(screen.getByRole('link', {name: 'Classify'})).toBeInTheDocument();
  expect(screen.getByRole('link', {name: 'About'})).toBeInTheDocument();
  // wait for the model info to arrive, so the test does not end mid-update
  expect(await screen.findByRole('button', {name: /predict/i})).toBeEnabled();
});

test('renders the classification form on the start page', async () => {
  render(<App/>);
  expect(screen.getByLabelText(/enter smiles or inchi/i)).toBeInTheDocument();
  expect(await screen.findByRole('button', {name: /predict/i})).toBeEnabled();
});

test('renders the about page with the models from the backend', async () => {
  window.history.pushState({}, '', '/about');
  render(<App/>);
  expect(screen.getByRole('heading', {name: 'About Chebifier'})).toBeVisible();
  expect(await screen.findByText(/2,234 ChEBI classes/)).toBeInTheDocument();
  for (const model of MODEL_INFO.available_models) {
    expect(screen.getByRole('heading', {name: model})).toBeInTheDocument();
  }
});
