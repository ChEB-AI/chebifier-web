import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import ClassificationGrid from './classification-form';
import {CLASSIFY_RESPONSE, MODEL_INFO, mockBackend} from '../test-fixtures';

/** Renders the form and waits until the model info has been loaded. */
async function renderForm() {
  const user = userEvent.setup();
  const view = render(<ClassificationGrid/>);
  await waitFor(() => expect(screen.getByRole('button', {name: /predict/i})).toBeEnabled());
  return {user, ...view};
}

const input = () => screen.getByLabelText(/enter smiles or inchi/i);
// jsdom's Blob has no text()
const readBlob = (blob) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.readAsText(blob);
});
const classifyRequests = () => axios.mock.calls.filter(([config]) => config.url === '/api/classify');

beforeEach(() => {
  mockBackend(axios);
});

test('loads the available models', async () => {
  await renderForm();
  expect(axios.get).toHaveBeenCalledWith('/api/modelinfo');
});

test('predict with empty input sends no request', async () => {
  const {user} = await renderForm();
  await user.click(screen.getByRole('button', {name: /predict/i}));
  await user.type(input(), '   ');
  await user.click(screen.getByRole('button', {name: /predict/i}));
  expect(classifyRequests()).toHaveLength(0);
  expect(screen.queryByText(/no classes predicted/i)).not.toBeInTheDocument();
});

test('predict shows the classes for each input, and flags inputs that cannot be read', async () => {
  const {user} = await renderForm();
  await user.type(input(), 'CCO{enter}not_a_smiles');
  await user.click(screen.getByRole('button', {name: /predict/i}));

  expect(await screen.findByRole('link', {name: 'primary alcohol'})).toHaveAttribute(
    'href', 'http://purl.obolibrary.org/obo/CHEBI_15734',
  );
  expect(screen.getByText(/could not process input/i)).toBeInTheDocument();

  const requests = classifyRequests();
  expect(requests).toHaveLength(1);
  const {data} = requests[0][0];
  expect(data.smiles).toEqual(['CCO', 'not_a_smiles']);
  // the whole ensemble runs by default
  expect(data.selectedModels).toEqual(
    Object.fromEntries(MODEL_INFO.available_models.map((model) => [model, true])),
  );
  expect(data.decisionThreshold).toBe(MODEL_INFO.decision_threshold);
});

test('a failing request shows the error from the backend', async () => {
  axios.mockImplementation(() => Promise.reject({
    response: {data: {message: 'Unknown model(s): \'foo\'.'}},
  }));
  const {user} = await renderForm();
  await user.type(input(), 'CCO');
  await user.click(screen.getByRole('button', {name: /predict/i}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Unknown model(s)');
});

test('upload puts the SMILES from the file into the input and classifies them', async () => {
  const {user} = await renderForm();
  // Windows line endings and a trailing newline, as files from users come
  const file = new File(['CCO\r\nnot_a_smiles\n'], 'molecules.txt', {type: 'text/plain'});
  await user.upload(screen.getByLabelText('SMILES file'), file);

  await waitFor(() => expect(input()).toHaveValue('CCO\nnot_a_smiles'));
  expect(await screen.findByRole('link', {name: 'primary alcohol'})).toBeInTheDocument();
  expect(classifyRequests()[0][0].data.smiles).toEqual(['CCO', 'not_a_smiles']);
});

describe('download', () => {
  let blobs;

  beforeEach(() => {
    blobs = [];
    // jsdom implements neither, and clicking the link would try to navigate
    URL.createObjectURL = jest.fn((blob) => {
      blobs.push(blob);
      return 'blob:predictions';
    });
    URL.revokeObjectURL = jest.fn();
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('is disabled before there are results', async () => {
    await renderForm();
    expect(screen.getByRole('button', {name: /download/i})).toBeDisabled();
  });

  test('saves the predictions as JSON', async () => {
    const {user} = await renderForm();
    await user.type(input(), 'CCO{enter}not_a_smiles');
    await user.click(screen.getByRole('button', {name: /predict/i}));
    await screen.findByRole('link', {name: 'primary alcohol'});

    const download = screen.getByRole('button', {name: /download/i});
    expect(download).toBeEnabled();
    await user.click(download);

    expect(blobs).toHaveLength(1);
    expect(blobs[0].type).toBe('application/json');
    const saved = JSON.parse(await readBlob(blobs[0]));
    // only inputs that could be classified end up in the file
    expect(saved).toEqual([{
      input: 'CCO',
      predicted_parents: CLASSIFY_RESPONSE.predicted_parents[0],
      direct_parents: CLASSIFY_RESPONSE.direct_parents[0],
    }]);
  });
});

test('details ask the backend for model-specific insights', async () => {
  const {user} = await renderForm();
  await user.type(input(), 'CCO');
  await user.click(screen.getByRole('button', {name: /predict/i}));
  await screen.findByRole('link', {name: 'primary alcohol'});

  await user.click(screen.getByRole('button', {name: /details/i}));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith('/api/details', expect.objectContaining({
    smiles: 'CCO',
  })));
});
