#!/usr/bin/env python3
"""Выкладка сайта на хостинг REG.RU по FTP/FTPS.

Настройки берутся из .deploy.env (файл не попадает в git).
Образец — .deploy.env.example.

    ./deploy.py              выложить изменённые файлы
    DRY_RUN=1 ./deploy.py    показать, что будет загружено, ничего не меняя
    LIST_ONLY=1 ./deploy.py  только список локальных файлов, без подключения
    DELETE=1 ./deploy.py     удалить на хостинге файлы, которых нет локально
"""

import calendar
import os
import socket
import ssl
import sys
import time
from ftplib import FTP, FTP_TLS, error_perm

ROOT = os.path.dirname(os.path.abspath(__file__))

EXCLUDE_DIRS = {".git", ".github", ".well-known", "cgi-bin", "error_docs", ".idea"}
EXCLUDE_FILES = {
    ".deploy.env",
    ".deploy.env.example",
    "deploy.py",
    "deploy.sh",
    "README.md",
    ".DS_Store",
}

# Ошибки, после которых имеет смысл переподключиться и повторить файл.
NETWORK_ERRORS = (socket.timeout, TimeoutError, ConnectionError, EOFError, OSError)


def load_env(path):
    values = {}
    if not os.path.exists(path):
        return values
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def local_files():
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = sorted(d for d in dirs if d not in EXCLUDE_DIRS)
        for name in sorted(files):
            if name in EXCLUDE_FILES:
                continue
            full = os.path.join(base, name)
            yield os.path.relpath(full, ROOT).replace(os.sep, "/"), full


def connect_ftp(host, user, password, use_tls, verify, timeout):
    if use_tls:
        context = ssl.create_default_context()
        if not verify:
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
        ftp = FTP_TLS(timeout=timeout, context=context)
        ftp.connect(host, 21)
        ftp.login(user, password)
        ftp.prot_p()
    else:
        ftp = FTP(timeout=timeout)
        ftp.connect(host, 21)
        ftp.login(user, password)

    ftp.set_pasv(True)
    # Без бинарного режима сервер не отвечает на SIZE, и все файлы
    # выглядят «изменёнными». Это же защищает видео и картинки от порчи.
    ftp.voidcmd("TYPE I")
    return ftp


def ensure_dirs(ftp, remote_path):
    parts = remote_path.split("/")[:-1]
    current = ""
    for part in parts:
        current = part if not current else current + "/" + part
        try:
            ftp.mkd(current)
        except error_perm:
            pass


def remote_uptodate(ftp, path, local_path):
    try:
        size = ftp.size(path)
    except error_perm:
        return False
    if size != os.path.getsize(local_path):
        return False

    try:
        response = ftp.sendcmd("MDTM " + path)
        if response.startswith("213"):
            remote_ts = calendar.timegm(time.strptime(response[4:].strip(), "%Y%m%d%H%M%S"))
            if remote_ts < 946684800:  # 2000-01-01: сервер вернул мусор вместо времени
                return True
            return os.path.getmtime(local_path) <= remote_ts + 300
    except (error_perm, ValueError):
        pass

    # Время узнать не удалось — доверяем совпадению размера.
    return True


def walk_remote(ftp, path=""):
    try:
        entries = list(ftp.mlsd(path or "."))
    except error_perm:
        return
    for name, facts in entries:
        if name in (".", ".."):
            continue
        rel = path + "/" + name if path else name
        kind = facts.get("type")
        if kind == "dir":
            yield from walk_remote(ftp, rel)
        elif kind == "file":
            yield rel


def delete_extra(ftp, keep, dry_run):
    removed = 0
    for rel in walk_remote(ftp):
        if rel in keep:
            continue
        head = rel.split("/")[0]
        if head in EXCLUDE_DIRS or os.path.basename(rel) in EXCLUDE_FILES:
            continue
        if dry_run:
            print("  − " + rel)
            removed += 1
            continue
        try:
            ftp.delete(rel)
            print("  − " + rel)
            removed += 1
        except error_perm as exc:
            print("  ! " + rel + ": " + str(exc))
    return removed


def main():
    env = load_env(os.path.join(ROOT, ".deploy.env"))

    def setting(name, default=""):
        return os.environ.get(name, env.get(name, default))

    host = setting("FTP_HOST")
    user = setting("FTP_USER")
    password = setting("FTP_PASS")
    remote_dir = setting("REMOTE_DIR", "www/karanelly.space")
    use_tls = setting("FTP_TLS", "1") == "1"
    verify = setting("FTP_VERIFY", "0") == "1"
    timeout = int(setting("FTP_TIMEOUT", "120"))
    dry_run = setting("DRY_RUN", "0") == "1"
    list_only = setting("LIST_ONLY", "0") == "1"
    do_delete = setting("DELETE", "0") == "1"

    files = list(local_files())

    if list_only:
        for rel, _ in files:
            print(rel)
        print("\nВсего файлов: " + str(len(files)))
        return

    for name, value in (("FTP_HOST", host), ("FTP_USER", user), ("FTP_PASS", password)):
        if not value:
            sys.exit("Не задан " + name + ". Скопируйте .deploy.env.example в .deploy.env и заполните.")

    print("→ " + user + "@" + host + ":" + remote_dir
          + "  (TLS=" + ("да" if use_tls else "нет")
          + ", timeout=" + str(timeout) + " c"
          + ", dry-run=" + ("да" if dry_run else "нет") + ")")

    def open_ftp():
        client = connect_ftp(host, user, password, use_tls, verify, timeout)
        client.cwd(remote_dir)
        return client

    try:
        ftp = open_ftp()
    except (error_perm,) + NETWORK_ERRORS as exc:
        sys.exit("Не удалось подключиться или открыть папку " + remote_dir + ": " + str(exc)
                 + ". Проверьте FTP_HOST, логин, пароль и REMOTE_DIR.")

    uploaded = 0
    skipped = 0
    failed = 0

    for rel, full in files:
        attempt = 0
        while True:
            attempt += 1
            try:
                if remote_uptodate(ftp, rel, full):
                    skipped += 1
                    break
                if dry_run:
                    print("  ↑ " + rel)
                    uploaded += 1
                    break
                ensure_dirs(ftp, rel)
                with open(full, "rb") as fh:
                    ftp.storbinary("STOR " + rel, fh, blocksize=262144)
                uploaded += 1
                print("  ↑ " + rel)
                break
            except error_perm as exc:
                print("  ! " + rel + ": " + str(exc))
                failed += 1
                break
            except NETWORK_ERRORS as exc:
                if attempt >= 2:
                    print("  ! " + rel + ": " + str(exc) + " (повтор не помог)")
                    failed += 1
                    break
                print("  … связь прервалась на " + rel + ", переподключаюсь")
                try:
                    ftp.close()
                except Exception:
                    pass
                try:
                    ftp = open_ftp()
                except (error_perm,) + NETWORK_ERRORS as reconnect_exc:
                    print("  ! не удалось переподключиться: " + str(reconnect_exc))
                    failed += 1
                    ftp = None
                    break

        if ftp is None:
            break

    removed = 0
    if do_delete and ftp is not None:
        removed = delete_extra(ftp, {rel for rel, _ in files}, dry_run)

    if ftp is not None:
        try:
            ftp.quit()
        except Exception:
            pass

    if dry_run:
        print("\nСухой прогон: к загрузке " + str(uploaded)
              + ", без изменений " + str(skipped)
              + (", к удалению " + str(removed) if do_delete else "")
              + (", ошибок " + str(failed) if failed else "") + ".")
        print("Запустите ./deploy.py, чтобы выложить изменения.")
    else:
        print("\nГотово: загружено " + str(uploaded)
              + ", без изменений " + str(skipped)
              + (", удалено " + str(removed) if do_delete else "")
              + (", ошибок " + str(failed) if failed else "") + ".")
        print("Проверьте https://karanelly.space/")


if __name__ == "__main__":
    main()
