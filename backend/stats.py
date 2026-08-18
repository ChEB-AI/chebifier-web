"""How many molecules Chebifier has classified.

The web app is served by uWSGI, which answers requests from several worker processes, so the count
cannot live in Python state - each worker would keep its own. It lives in a SQLite file instead:
the increment is a single statement inside a transaction, so concurrent workers cannot lose a
count the way a read-modify-write on a plain file would, and the database survives a crash
mid-write.

Only the number of molecules and the day it happened are stored - never the molecules themselves,
which the app promises not to keep.
"""

import os
import sqlite3
from contextlib import closing
from datetime import datetime, timezone

from app import app

_SCHEMA = """
CREATE TABLE IF NOT EXISTS predictions (
    day TEXT PRIMARY KEY,
    molecules INTEGER NOT NULL
)
"""

_path = app.config.get("STATS_DB")


def _connect():
    connection = sqlite3.connect(_path, timeout=10)
    # readers never block the writer, and the writer never blocks on a reader
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute(_SCHEMA)
    return connection


def _prepare():
    if not _path:
        print("No STATS_DB configured, predictions are not counted.")
        return False
    os.makedirs(os.path.dirname(os.path.abspath(_path)), exist_ok=True)
    with closing(_connect()):
        pass
    print(f"Counting predictions in {_path}.")
    return True


try:
    ENABLED = _prepare()
except sqlite3.Error as error:
    print(f"Could not open the prediction counter ({error}), predictions are not counted.")
    ENABLED = False


def record(molecules: int) -> None:
    """Add to the count for today. Never raises - a prediction is worth more than its tally."""
    if not ENABLED or molecules <= 0:
        return
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    try:
        # `with connection` commits the transaction but leaves the handle open, so the close has
        # to be asked for separately - otherwise every request leaks one
        with closing(_connect()) as connection, connection:
            connection.execute(
                "INSERT INTO predictions (day, molecules) VALUES (?, ?) "
                "ON CONFLICT(day) DO UPDATE SET molecules = molecules + excluded.molecules",
                (day, molecules),
            )
    except sqlite3.Error as error:
        print(f"Could not count {molecules} predictions: {error}")


def summary() -> dict:
    """The total and the day counting started, or an empty summary if nothing was counted yet."""
    if not ENABLED:
        return {"molecules": None, "since": None}
    try:
        with closing(_connect()) as connection:
            total, since = connection.execute(
                "SELECT SUM(molecules), MIN(day) FROM predictions"
            ).fetchone()
    except sqlite3.Error as error:
        print(f"Could not read the prediction counter: {error}")
        return {"molecules": None, "since": None}
    return {"molecules": total, "since": since}
