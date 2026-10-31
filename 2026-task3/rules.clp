;;; Правила для поддержки 1С


; Факты

(deftemplate ticket
   (slot symptom (type SYMBOL)
      (allowed-symbols no-start slow lock-error license exchange-error
                       post-error report-error update-error print-error other))
   (slot db-type (type SYMBOL) (allowed-symbols file server))
   (slot users (type INTEGER) (default 1))
   (slot scope (type SYMBOL) (allowed-symbols one all))
   (slot recent-update (type SYMBOL) (allowed-symbols yes no)))

(deftemplate sign
   (slot name (type SYMBOL)))

(deftemplate diagnosis
   (slot id (type STRING))
   (slot cause (type STRING))
   (slot actions (type STRING))
   (slot executor (type STRING))
   (slot cf (type FLOAT)))

(deftemplate priority
   (slot level (type STRING))
   (slot term (type STRING)))

(deftemplate trace
   (slot rule (type STRING))
   (slot text (type STRING)))

; Сначала собираем признаки

(defrule R1-file-overload
   (declare (salience 20))
   (ticket (db-type file) (users ?u&:(> ?u 5)))
   =>
   (assert (sign (name file-overload)))
   (assert (trace (rule "R1")
      (text (str-cat "Файловая база и " ?u " пользователей: база работает с перегрузкой")))))

(defrule R2-after-update
   (declare (salience 20))
   (ticket (recent-update yes))
   =>
   (assert (sign (name after-update)))
   (assert (trace (rule "R2") (text "Недавно было обновление: проблема может быть связана с ним"))))

(defrule R3-mass-problem
   (declare (salience 20))
   (ticket (scope all))
   =>
   (assert (sign (name mass-problem)))
   (assert (trace (rule "R3") (text "Проблема у всех пользователей: массовый сбой"))))

(defrule R4-local-problem
   (declare (salience 20))
   (ticket (scope one))
   =>
   (assert (sign (name local-problem)))
   (assert (trace (rule "R4") (text "Проблема у одного пользователя: локальный сбой на рабочем месте"))))

; Возможные причины

(defrule R5-slow-file-overload
   (declare (salience 10))
   (ticket (symptom slow))
   (sign (name file-overload))
   =>
   (assert (diagnosis (id "R5") (cf 0.85)
      (cause "Файловая база не справляется с числом пользователей")
      (actions "Перевести базу на клиент-серверный вариант (PostgreSQL или MS SQL), до перехода выполнить тестирование и исправление базы")
      (executor "Программист 1С и системный администратор")))
   (assert (trace (rule "R5") (text "Медленная работа + перегруженная файловая база"))))

(defrule R6-slow-server-mass
   (declare (salience 10))
   (ticket (symptom slow) (db-type server))
   (sign (name mass-problem))
   =>
   (assert (diagnosis (id "R6") (cf 0.7)
      (cause "Не хватает ресурсов сервера 1С или СУБД")
      (actions "Проверить загрузку процессора, памяти и диска на сервере, регламентные задания, обновить статистику и индексы СУБД")
      (executor "Системный администратор")))
   (assert (trace (rule "R6") (text "Медленная работа у всех на клиент-серверной базе"))))

(defrule R7-slow-local
   (declare (salience 10))
   (ticket (symptom slow))
   (sign (name local-problem))
   =>
   (assert (diagnosis (id "R7") (cf 0.7)
      (cause "Проблема на рабочем месте пользователя")
      (actions "Очистить кэш 1С, проверить сеть и загрузку компьютера пользователя")
      (executor "Консультант 1С")))
   (assert (trace (rule "R7") (text "Медленная работа только у одного пользователя"))))

(defrule R8-nostart-mass
   (declare (salience 10))
   (ticket (symptom no-start))
   (sign (name mass-problem))
   =>
   (assert (diagnosis (id "R8") (cf 0.75)
      (cause "Недоступен сервер 1С или сетевая папка с базой")
      (actions "Проверить работу службы сервера 1С или доступ к папке с базой, состояние сети")
      (executor "Системный администратор")))
   (assert (trace (rule "R8") (text "База не открывается ни у кого"))))

(defrule R9-nostart-local
   (declare (salience 10))
   (ticket (symptom no-start))
   (sign (name local-problem))
   =>
   (assert (diagnosis (id "R9") (cf 0.7)
      (cause "Повреждён кэш или настройки клиента 1С")
      (actions "Очистить кэш, проверить список баз, при необходимости переустановить платформу")
      (executor "Консультант 1С")))
   (assert (trace (rule "R9") (text "База не открывается только у одного пользователя"))))

(defrule R10-nostart-update
   (declare (salience 10))
   (ticket (symptom no-start))
   (sign (name after-update))
   =>
   (assert (diagnosis (id "R10") (cf 0.8)
      (cause "Версия платформы не подходит для обновлённой конфигурации")
      (actions "Установить версию платформы, которую требует конфигурация, на сервер и рабочие места")
      (executor "Консультант 1С")))
   (assert (trace (rule "R10") (text "База перестала открываться после обновления"))))

(defrule R11-license
   (declare (salience 10))
   (ticket (symptom license))
   =>
   (assert (diagnosis (id "R11") (cf 0.9)
      (cause "Лицензия не найдена или все лицензии заняты")
      (actions "Проверить ключ защиты или программную лицензию, сервер лицензий и количество открытых сеансов")
      (executor "Консультант 1С")))
   (assert (trace (rule "R11") (text "Сообщение об отсутствии лицензии"))))

(defrule R12-lock-file
   (declare (salience 10))
   (ticket (symptom lock-error) (db-type file))
   =>
   (assert (diagnosis (id "R12") (cf 0.75)
      (cause "Конфликт блокировок в файловой базе")
      (actions "Развести по времени тяжёлые операции (закрытие месяца, обмены), рассмотреть переход на клиент-серверный вариант")
      (executor "Программист 1С")))
   (assert (trace (rule "R12") (text "Ошибка блокировки в файловой базе"))))

(defrule R13-lock-server
   (declare (salience 10))
   (ticket (symptom lock-error) (db-type server))
   =>
   (assert (diagnosis (id "R13") (cf 0.7)
      (cause "Длительные транзакции или автоматический режим блокировок")
      (actions "Найти долгие транзакции по технологическому журналу, перевести конфигурацию в управляемый режим блокировок")
      (executor "Программист 1С")))
   (assert (trace (rule "R13") (text "Ошибка блокировки в клиент-серверной базе"))))

(defrule R14-exchange-update
   (declare (salience 10))
   (ticket (symptom exchange-error))
   (sign (name after-update))
   =>
   (assert (diagnosis (id "R14") (cf 0.8)
      (cause "После обновления не совпадают версии или правила обмена")
      (actions "Обновить конфигурации на обеих сторонах обмена до совместимых версий, загрузить актуальные правила обмена")
      (executor "Программист 1С")))
   (assert (trace (rule "R14") (text "Ошибка обмена после обновления"))))

(defrule R15-exchange-data
   (declare (salience 10))
   (ticket (symptom exchange-error) (recent-update no))
   =>
   (assert (diagnosis (id "R15") (cf 0.6)
      (cause "Ошибка в данных или сбой связи при обмене")
      (actions "Посмотреть журнал регистрации и протокол обмена, проверить доступность второй базы и настройки обмена")
      (executor "Консультант 1С")))
   (assert (trace (rule "R15") (text "Ошибка обмена без обновлений"))))

(defrule R16-post-accounting
   (declare (salience 10))
   (ticket (symptom post-error))
   =>
   (assert (diagnosis (id "R16") (cf 0.7)
      (cause "Учётная ошибка: нет остатков, не заполнены реквизиты или закрыт период")
      (actions "Прочитать сообщение при проведении, проверить остатки, обязательные реквизиты и дату запрета изменения")
      (executor "Консультант 1С")))
   (assert (trace (rule "R16") (text "Документ не проводится"))))

(defrule R17-post-update
   (declare (salience 10))
   (ticket (symptom post-error))
   (sign (name after-update))
   =>
   (assert (diagnosis (id "R17") (cf 0.65)
      (cause "Ошибка в доработках после обновления конфигурации")
      (actions "Проверить доработки на копии базы, сравнить с типовой конфигурацией и исправить код")
      (executor "Программист 1С")))
   (assert (trace (rule "R17") (text "Документ перестал проводиться после обновления"))))

(defrule R18-report
   (declare (salience 10))
   (ticket (symptom report-error))
   =>
   (assert (diagnosis (id "R18") (cf 0.65)
      (cause "В отчёт попали непроведённые документы или не закрыт месяц")
      (actions "Перепровести документы за период, выполнить закрытие месяца, сформировать отчёт заново")
      (executor "Консультант 1С")))
   (assert (trace (rule "R18") (text "Неверные данные в отчётах"))))

(defrule R19-update-error
   (declare (salience 10))
   (ticket (symptom update-error))
   =>
   (assert (diagnosis (id "R19") (cf 0.85)
      (cause "Сбой при обновлении конфигурации")
      (actions "Восстановить базу из резервной копии, выполнить тестирование и исправление, повторить обновление по шагам")
      (executor "Программист 1С")))
   (assert (trace (rule "R19") (text "Ошибка во время обновления"))))

(defrule R20-print-local
   (declare (salience 10))
   (ticket (symptom print-error))
   (sign (name local-problem))
   =>
   (assert (diagnosis (id "R20") (cf 0.75)
      (cause "Проблема с принтером или драйвером на рабочем месте")
      (actions "Проверить принтер по умолчанию, драйвер и печать из других программ")
      (executor "Системный администратор")))
   (assert (trace (rule "R20") (text "Не печатает у одного пользователя"))))

(defrule R21-print-mass
   (declare (salience 10))
   (ticket (symptom print-error))
   (sign (name mass-problem))
   =>
   (assert (diagnosis (id "R21") (cf 0.65)
      (cause "Ошибка в печатной форме или на сервере печати")
      (actions "Проверить печатную форму в конфигурации (особенно после изменений) и сервер печати")
      (executor "Программист 1С")))
   (assert (trace (rule "R21") (text "Не печатает ни у кого"))))

(defrule D0-unknown
   (declare (salience -10))
   (ticket)
   (not (diagnosis))
   =>
   (assert (diagnosis (id "D0") (cf 0.5)
      (cause "Причина не определена по базе знаний")
      (actions "Собрать подробности (текст ошибки, скриншот, журнал регистрации) и передать обращение на вторую линию")
      (executor "Ведущий специалист")))
   (assert (trace (rule "D0") (text "Ни одно правило не подошло"))))

; Приоритет

(defrule P1-critical
   (declare (salience 5))
   (ticket (symptom no-start|license))
   (sign (name mass-problem))
   (not (priority))
   =>
   (assert (priority (level "Критический") (term "до 1 часа")))
   (assert (trace (rule "P1") (text "Работа всех пользователей остановлена: критический приоритет"))))

(defrule P2-high
   (declare (salience 4))
   (sign (name mass-problem))
   (not (priority))
   =>
   (assert (priority (level "Высокий") (term "до 4 часов")))
   (assert (trace (rule "P2") (text "Массовая проблема: высокий приоритет"))))

(defrule P3-low
   (declare (salience 3))
   (ticket (symptom report-error|print-error))
   (sign (name local-problem))
   (not (priority))
   =>
   (assert (priority (level "Низкий") (term "до 3 рабочих дней")))
   (assert (trace (rule "P3") (text "Локальная проблема, работа не остановлена: низкий приоритет"))))

(defrule P4-medium
   (declare (salience 2))
   (sign (name local-problem))
   (not (priority))
   =>
   (assert (priority (level "Средний") (term "до 1 рабочего дня")))
   (assert (trace (rule "P4") (text "Локальная проблема: средний приоритет"))))
