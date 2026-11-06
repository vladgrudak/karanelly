#!/usr/bin/env python3
"""Поднимает версию у CSS/JS во всех HTML-файлах: style.css?v=...

Запускать перед деплоем, если менялись стили или скрипты. Версия — текущее
время (YYYYMMDDHHMM): у пользователей с уже закэшированными файлами адрес
меняется, и браузер скачивает свежие.
"""

import glob
import re
import time

VERSION = time.strftime("%Y%m%d%H%M")

PATTERN = re.compile(
    r'((?:href|src)="(?:/|\.\./)?assets/(?:css|js)/[^"?]+\.(?:css|js))'
    r'(?:\?v=[\w.-]+)?(")'
)

changed = 0
for path in sorted(glob.glob("**/*.html", recursive=True)):
    if path.startswith("newPhoto/"):
        continue
    with open(path, encoding="utf-8") as fh:
        source = fh.read()
    updated, count = PATTERN.subn(lambda m: m.group(1) + "?v=" + VERSION + m.group(2), source)
    if count and updated != source:
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(updated)
        changed += 1

print("Версия " + VERSION + ": обновлено файлов " + str(changed))
