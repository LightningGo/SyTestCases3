"""
Обработка результатов юзабилити-теста из выгрузки формы (CSV)
Запуск: python 4_analyze.py results.csv
"""
import csv
import re
import sys
from pathlib import Path
from statistics import mean

TASKS = 6
CHECKS = {
    2: lambda a: bool(re.fullmatch(r'(?:до\s+)?27(?:[./]0?7(?:[./]2026)?|\s+июля(?:\s+2026)?)?', a.strip().lower())),
    3: lambda a: a.strip().lower().replace('«', '').replace('»', '') in (
        'конференция', 'конференция 1с: цифровая трансформация', '1с: цифровая трансформация'),
    6: lambda a: a.strip().lower() in ('0', 'ноль', 'нет', 'ни одной', '0 заметок'),
}
TIMES = ['до 30 секунд', '30–60 секунд', '1–2 минуты', 'больше 2 минут']


def load(path):
    with open(path, encoding='utf-8-sig', newline='') as f:
        sample = f.read(4096)
        if not sample.strip():
            return []
        f.seek(0)
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=',;\t')
        except csv.Error as exc:
            raise ValueError('Не удалось определить разделитель CSV: нужны запятая, ; или табуляция') from exc
        reader = csv.DictReader(f, dialect=dialect)
        codes = [re.match(r'\[([^]]+)\]', (name or '').strip()) for name in reader.fieldnames or []]
        codes = [m[1] for m in codes if m]
        required = {f'SUS{i}' for i in range(1, 11)} | {
            f'З{t}-{field}' for t in range(1, TASKS + 1) for field in ('итог', 'сложность', 'время')
        } | {'З2-ответ', 'З3-ответ', 'З6-ответ'}
        missing = required - set(codes)
        if missing:
            raise ValueError('Нет столбцов: ' + ', '.join(sorted(missing)))
        if len(codes) != len(set(codes)):
            raise ValueError('Коды вопросов повторяются в заголовках CSV')
        rows = list(reader)
        if any(None in row for row in rows):
            raise ValueError('Число значений в строке больше числа заголовков')
        return [r for r in rows if any((v or '').strip() for v in r.values())]


def col(row, code):
    for key, value in row.items():
        if key and key.strip().startswith(f'[{code}]'):
            return (value or '').strip()
    return ''


def num(value):
    return int(value.strip()) if re.fullmatch(r'[0-9]+', value.strip()) else None


def sus(row):
    scores = [num(col(row, f'SUS{i}')) for i in range(1, 11)]
    if any(s is None or not 1 <= s <= 5 for s in scores):
        return None
    total = sum(s - 1 if i % 2 == 0 else 5 - s for i, s in enumerate(scores))
    return total * 2.5


def main(path):
    rows = load(path)
    n = len(rows)
    if not n:
        raise ValueError('В файле нет ответов. Новый отчёт не сформирован; прежний summary.txt не обновлён.')
    lines = [f'Участников: {n}', '']

    lines.append('Задача | Успешно (по словам) | Проверено ответом | С трудом | Не смогли | SEQ (1-7) | Время')
    for t in range(1, TASKS + 1):
        results = [col(r, f'З{t}-итог').lower() for r in rows]
        ok = sum(r.startswith('да') for r in results)
        hard = sum('с трудом' in r for r in results)
        fail = sum(r.startswith('нет') for r in results)
        seq = [x for x in (num(col(r, f'З{t}-сложность')) for r in rows) if x is not None and 1 <= x <= 7]
        times = [col(r, f'З{t}-время') for r in rows]
        time_text = ', '.join(f'{t_}: {times.count(t_)}' for t_ in TIMES if times.count(t_))
        checked = '-'
        if t in CHECKS:
            right = sum(CHECKS[t](col(r, f'З{t}-ответ')) for r in rows)
            checked = f'{right}/{n}'
        seq_text = f'{mean(seq):.1f} (n={len(seq)})' if seq else 'нет корректных оценок'
        lines.append(f'З{t} | {ok}/{n} ({ok / n:.0%}) | {checked} | {hard} | {fail} | '
                     f'{seq_text} | {time_text or "нет данных"}')
        if len(seq) < n:
            lines.append(f'  З{t}: пропущено/неверно SEQ — {n - len(seq)}; проверьте исходные ячейки.')
        unknown = n - ok - fail
        if unknown:
            lines.append(f'  З{t}: нет распознанного ответа об успешности — {unknown}.')
        if t in CHECKS:
            unmatched = [col(r, f'З{t}-ответ') for r in rows if not CHECKS[t](col(r, f'З{t}-ответ'))]
            if unmatched:
                lines.append('  Не распознано автоматически, проверить вручную: ' + repr(unmatched))

    scores = [s for s in (sus(r) for r in rows) if s is not None]
    lines.append(f'Корректных анкет SUS: {len(scores)}/{n}; пропущено/неверно: {n - len(scores)}')
    lines += ['', 'SUS по участникам: ' + ', '.join(f'{s:.1f}' for s in scores)]
    if scores:
        lines.append(f'SUS средний: {mean(scores):.1f} (порог среднего уровня 68)')

    lines += ['', 'Что мешало (по задачам):']
    for t in range(1, TASKS + 1):
        for r in rows:
            text = col(r, f'З{t}-проблема')
            if text:
                lines.append(f'  З{t}: {text}')

    for code, title in [('О1', 'Самое неудобное'), ('О2', 'Понравилось'), ('О3', 'Не хватает')]:
        lines += ['', f'{title}:']
        lines += [f'  - {col(r, code)}' for r in rows if col(r, code)]

    report = '\n'.join(lines)
    print(report)
    output = Path(path).resolve().with_name('summary.txt')
    with open(output, 'w', encoding='utf-8') as f:
        f.write(report)
    print(f'\nСохранено в {output}')


if __name__ == '__main__':
    try:
        main(sys.argv[1] if len(sys.argv) > 1 else 'results.csv')
    except (OSError, ValueError, csv.Error) as exc:
        print(f'Ошибка: {exc}', file=sys.stderr)
        sys.exit(1)
