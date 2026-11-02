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
import ssl
import sys
import time
from ftplib import FTP, FTP_TLS, error_perm

ROOT = os.path.dirname(os.path.abspath(__file__))

EXCLUDE_DIRS = {".git", ".github", ".well-known", "cgi-bin", "error_docs"}
EXCLUDE_FILES = {
    ".deploy.env",
    ".deploy.env.example",
    "deploy.py",
    "deploy.sh",
    "README.md",
    ".DS_Store",
}


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
            return os.path.getmtime(local_path) <= remote_ts + 120
    except (error_perm, ValueError):
        pass
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
          + ", dry-run=" + ("да" if dry_run else "нет") + ")")

    if use_tls:
        context = ssl.create_default_context()
        if not verify:
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
        ftp = FTP_TLS(context=context)
        ftp.connect(host, 21, timeout=30)
        ftp.login(user, password)
        ftp.prot_p()
    else:
        ftp = FTP(host, timeout=30)
        ftp.login(user, password)

    ftp.set_pasv(True)

    try:
        ftp.cwd(remote_dir)
    except error_perm as exc:
        try:
            ftp.quit()
        except Exception:
            pass
        sys.exit("Не удалось открыть папку " + remote_dir + ": " + str(exc)
                 + ". Проверьте REMOTE_DIR в .deploy.env.")

    uploaded = 0
    skipped = 0
    for rel, full in files:
        try:
            if remote_uptodate(ftp, rel, full):
                skipped += 1
                continue
            if dry_run:
                print("  ↑ " + rel)
                uploaded += 1
                continue
            ensure_dirs(ftp, rel)
            with open(full, "rb") as fh:
                ftp.storbinary("STOR " + rel, fh, blocksize=65536)
            uploaded += 1
            print("  ↑ " + rel)
        except error_perm as exc:
            print("  ! " + rel + ": " + str(exc))

    removed = 0
    if do_delete:
        removed = delete_extra(ftp, {rel for rel, _ in files}, dry_run)

    try:
        ftp.quit()
    except Exception:
        pass

    print("\nГотово: загружено " + str(uploaded)
          + ", без изменений " + str(skipped)
          + (", удалено " + str(removed) if do_delete else "") + ".")
    print("Проверьте https://karanelly.space/")


if __name__ == "__main__":
    main()
