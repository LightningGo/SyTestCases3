"""
Экспертная система «Диагностика обращений в техподдержку 1С» на Flask + CLIPS
"""
import os
import secrets
from flask import Flask, render_template, request, flash, redirect
from expert import diagnose, RULES_FILE, SYMPTOMS, DB_TYPES, SCOPES, ANSWERS

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY') or secrets.token_hex(32)


@app.route('/')
def index():
    return render_template('index.html', symptoms=SYMPTOMS, db_types=DB_TYPES,
                           scopes=SCOPES, answers=ANSWERS)


@app.route('/diagnose', methods=['POST'])
def run_diagnose():
    form = request.form
    try:
        result = diagnose(form.get('symptom'), form.get('db_type'), form.get('users'),
                          form.get('scope'), form.get('recent_update'))
    except ValueError:
        flash('Заполните все поля, количество пользователей должно быть числом больше 0')
        return redirect('/')

    ticket = {
        'Проблема': SYMPTOMS[form['symptom']],
        'Тип базы': DB_TYPES[form['db_type']],
        'Пользователей в базе': form['users'],
        'Кого затронуло': SCOPES[form['scope']],
        'Недавно было обновление': ANSWERS[form['recent_update']],
    }
    return render_template('result.html', ticket=ticket, result=result)


@app.route('/knowledge')
def knowledge():
    with open(RULES_FILE, encoding='utf-8') as f:
        rules_text = f.read()
    return render_template('knowledge.html', rules_text=rules_text)


if __name__ == '__main__':
    app.run(debug=os.environ.get('FLASK_DEBUG') == '1')
