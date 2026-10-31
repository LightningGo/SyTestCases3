"""
Механизм логического вывода: CLIPS через библиотеку clipspy
"""
import os
import re
import clips

RULES_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'rules.clp')

SYMPTOMS = {
    'no-start': '1С не запускается / база не открывается',
    'slow': 'Программа работает медленно',
    'lock-error': 'Ошибка блокировки данных',
    'license': 'Не найдена лицензия',
    'exchange-error': 'Ошибка обмена данными',
    'post-error': 'Документ не проводится',
    'report-error': 'Неверные данные в отчётах',
    'update-error': 'Ошибка при обновлении конфигурации',
    'print-error': 'Не печатаются документы',
    'other': 'Другое',
}
DB_TYPES = {'file': 'Файловая', 'server': 'Клиент-серверная'}
SCOPES = {'one': 'У одного пользователя', 'all': 'У всех пользователей'}
ANSWERS = {'yes': 'Да', 'no': 'Нет'}


def diagnose(symptom, db_type, users, scope, recent_update):
    if symptom not in SYMPTOMS or db_type not in DB_TYPES or scope not in SCOPES \
            or recent_update not in ANSWERS:
        raise ValueError('Некорректные входные данные')
    if isinstance(users, bool) or not isinstance(users, (int, str)) \
            or not re.fullmatch(r'[0-9]{1,19}', str(users).strip()):
        raise ValueError('Количество пользователей должно быть целым числом')
    users = int(users)
    if not 1 <= users <= 2**63 - 1:
        raise ValueError('Количество пользователей вне допустимого диапазона')

    env = clips.Environment()
    env.load(RULES_FILE)
    env.reset()
    env.find_template('ticket').assert_fact(**{
        'symptom': clips.Symbol(symptom),
        'db-type': clips.Symbol(db_type),
        'users': users,
        'scope': clips.Symbol(scope),
        'recent-update': clips.Symbol(recent_update),
    })
    # env.eval('(watch rules)')  # Раскомментировать, чтобы видеть срабатывающие правила.
    env.run()

    diagnoses = [dict(f) for f in env.find_template('diagnosis').facts()]
    diagnoses.sort(key=lambda d: d['cf'], reverse=True)
    priority = next((dict(f) for f in env.find_template('priority').facts()), None)
    trace = [dict(f) for f in env.find_template('trace').facts()]
    return {'diagnoses': diagnoses, 'priority': priority, 'trace': trace}
