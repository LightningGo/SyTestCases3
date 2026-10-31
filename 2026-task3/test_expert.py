import pytest
from expert import diagnose
from app import app


def ids(result):
    return [d['id'] for d in result['diagnoses']]


@pytest.mark.parametrize('args, first, priority', [
    (('slow', 'file', 8, 'all', 'no'), 'R5', 'Высокий'),
    (('slow', 'server', 30, 'all', 'no'), 'R6', 'Высокий'),
    (('slow', 'server', 30, 'one', 'no'), 'R7', 'Средний'),
    (('no-start', 'server', 20, 'all', 'yes'), 'R10', 'Критический'),
    (('no-start', 'file', 3, 'one', 'no'), 'R9', 'Средний'),
    (('license', 'file', 2, 'all', 'no'), 'R11', 'Критический'),
    (('lock-error', 'server', 40, 'all', 'no'), 'R13', 'Высокий'),
    (('exchange-error', 'file', 2, 'one', 'yes'), 'R14', 'Средний'),
    (('update-error', 'file', 1, 'one', 'yes'), 'R19', 'Средний'),
    (('print-error', 'file', 3, 'one', 'no'), 'R20', 'Низкий'),
    (('other', 'file', 1, 'one', 'no'), 'D0', 'Средний'),
])
def test_cases(args, first, priority):
    result = diagnose(*args)
    assert ids(result)[0] == first
    assert result['priority']['level'] == priority


def test_several_causes_sorted_by_cf():
    result = diagnose('no-start', 'server', 20, 'all', 'yes')
    assert ids(result) == ['R10', 'R8']


def test_trace_explains_chain():
    result = diagnose('slow', 'file', 8, 'all', 'no')
    rules = [t['rule'] for t in result['trace']]
    assert rules == ['R1', 'R3', 'R5', 'P2']


def test_unknown_only_when_nothing_found():
    assert 'D0' not in ids(diagnose('post-error', 'file', 2, 'one', 'no'))


@pytest.mark.parametrize('args', [
    ('fire', 'file', 1, 'one', 'no'),
    ('slow', 'cloud', 1, 'one', 'no'),
    ('slow', 'file', 0, 'one', 'no'),
    ('slow', 'file', 'abc', 'one', 'no'),
])
def test_bad_input(args):
    with pytest.raises(ValueError):
        diagnose(*args)


def test_web_form():
    client = app.test_client()
    assert client.get('/').status_code == 200
    resp = client.post('/diagnose', data={'symptom': 'license', 'db_type': 'file', 'users': '2',
                                          'scope': 'all', 'recent_update': 'no'})
    text = resp.get_data(as_text=True)
    assert 'Лицензия не найдена' in text
    assert 'Критический' in text


def test_web_form_empty():
    resp = app.test_client().post('/diagnose', data={})
    assert resp.status_code == 302


@pytest.mark.parametrize('users', [None, True, 1.5, '1.5', 10**30])
def test_invalid_user_count_is_validation_error(users):
    with pytest.raises(ValueError):
        diagnose('slow', 'file', users, 'all', 'no')


def test_missing_users_does_not_produce_result():
    response = app.test_client().post('/diagnose', data={
        'symptom': 'slow', 'db_type': 'file', 'scope': 'all', 'recent_update': 'no',
    })
    assert response.status_code == 302
