"""Shared fixtures for the API tests.

The tests run against the real application with the real ensemble: importing `app` loads the
ChEBI graph and every model of the configured ensemble (downloading them from Hugging Face on the
first run), which is slow - so it happens once per session. A `config.json` has to be present in
the backend directory, as for `flask run`; CI uses `tests/config.ci.json`.
"""

import pytest


@pytest.fixture(scope="session")
def flask_app():
    # imported here rather than at module level so that collecting the tests stays cheap, and only
    # once - app.py sets the multiprocessing start method, which may only happen a single time
    from app import app

    app.config.update(TESTING=True)
    return app


@pytest.fixture(scope="session")
def client(flask_app):
    return flask_app.test_client()


@pytest.fixture(scope="session")
def modelinfo(client):
    response = client.get("/api/modelinfo")
    assert response.status_code == 200
    return response.get_json()


@pytest.fixture
def classify(client):
    """POST to /api/classify, returning the response."""

    def _classify(**payload):
        return client.post("/api/classify", json=payload)

    return _classify
