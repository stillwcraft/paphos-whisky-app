import pytest

import security


@pytest.fixture(autouse=True)
def reset_rate_limits():
    security._hits.clear()
    yield
    security._hits.clear()
