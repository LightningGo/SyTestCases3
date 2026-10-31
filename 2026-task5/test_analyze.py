import csv
import importlib.util
from pathlib import Path
import tempfile
import unittest
import contextlib
import io

spec = importlib.util.spec_from_file_location('analyze', Path(__file__).with_name('4_analyze.py'))
analyze = importlib.util.module_from_spec(spec)
spec.loader.exec_module(analyze)


class AnalysisTests(unittest.TestCase):
    def row(self, odd=5, even=1):
        return {f'[SUS{i}] вопрос': str(odd if i % 2 else even) for i in range(1, 11)}

    def test_sus_endpoints_and_midpoint(self):
        self.assertEqual(analyze.sus(self.row()), 100)
        self.assertEqual(analyze.sus(self.row(1, 5)), 0)
        self.assertEqual(analyze.sus(self.row(3, 3)), 50)

    def test_sus_rejects_out_of_range_and_non_integer(self):
        for value in ('0', '9', '-1', '1.5', 'ответ 5'):
            row = self.row()
            row['[SUS1] вопрос'] = value
            self.assertIsNone(analyze.sus(row), value)

    def test_control_answers_do_not_accept_substrings(self):
        for value in ('127', '27.08', 'не 27', '27.07.2025'):
            self.assertFalse(analyze.CHECKS[2](value), value)
        self.assertTrue(analyze.CHECKS[2]('27 июля'))
        self.assertFalse(analyze.CHECKS[3]('не конференция'))
        self.assertTrue(analyze.CHECKS[3]('Конференция'))
        self.assertTrue(analyze.CHECKS[6]('Нет'))

    def test_empty_csv_has_no_answers(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Path(folder) / 'empty.csv'
            p.write_text('', encoding='utf-8')
            self.assertEqual(analyze.load(p), [])

    def test_missing_required_columns_is_error(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Path(folder) / 'wrong.csv'
            p.write_text('name,value\nAlice,5\n', encoding='utf-8')
            with self.assertRaises(ValueError):
                analyze.load(p)

    def test_empty_input_does_not_succeed_with_old_summary(self):
        with tempfile.TemporaryDirectory() as folder:
            p=Path(folder)/'empty.csv'
            p.write_text('',encoding='utf-8')
            report=p.with_name('summary.txt')
            report.write_text('старые результаты',encoding='utf-8')
            with self.assertRaises(ValueError):
                analyze.main(p)
            self.assertEqual(report.read_text(encoding='utf-8'),'старые результаты')

    def test_report_keeps_success_without_seq_and_ignores_invalid_seq(self):
        with tempfile.TemporaryDirectory() as folder:
            row = self.row()
            for t in range(1, 7):
                row.update({f'[З{t}-итог]': 'Да, сразу', f'[З{t}-сложность]': '' if t == 1 else '99',
                            f'[З{t}-время]': 'до 30 секунд'})
            row.update({'[З2-ответ]':'27', '[З3-ответ]':'Конференция', '[З6-ответ]':'0'})
            p = Path(folder) / 'answers.csv'
            with p.open('w', encoding='utf-8-sig', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=row.keys(), delimiter=';')
                writer.writeheader()
                writer.writerow(row)
            with contextlib.redirect_stdout(io.StringIO()):
                analyze.main(p)
            report = p.with_name('summary.txt').read_text(encoding='utf-8')
            self.assertIn('З1 | 1/1 (100%)', report)
            self.assertNotIn('99.0', report)
            self.assertIn('100.0', report)


if __name__ == '__main__':
    unittest.main()
