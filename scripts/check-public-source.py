"""Audit staged source files without printing secrets or credential values."""
from pathlib import Path
import subprocess, re
root=Path(__file__).resolve().parent.parent
files=subprocess.check_output(['git','ls-files','-z'],cwd=root).decode().split('\0')
private_names={'доступ.txt','доступ ssh.txt','.env','.env.local'}
private_prefixes=('.deployment/','.tools/','.voice-tools/','.test-artifacts/','node_modules/','artifacts/')
needles=[]
access=root/'доступ.txt'
if access.exists():
    lines=access.read_text(encoding='utf-8-sig').splitlines()
    for label in ['Логин:','Пароль:']:
        if label in lines: needles.append(lines[lines.index(label)+1].strip().encode())
ssh_access=root/'доступ ssh.txt'
if ssh_access.exists():
    ssh_lines=[line.strip() for line in ssh_access.read_text(encoding='utf-8-sig').splitlines() if line.strip()]
    if len(ssh_lines)>=2 and len(ssh_lines[1])>=8:
        needles.append(ssh_lines[1].encode())
errors=[]
for name in filter(None,files):
    path=root/name
    if name in private_names or name.startswith(private_prefixes): errors.append(name+' (private file)'); continue
    data=subprocess.check_output(['git','show',':'+name],cwd=root)
    if len(data)>100_000_000: errors.append(name+' (too large for GitHub)')
    if any(value and value in data for value in needles): errors.append(name+' (ISP credential match)')
    if b'-----BEGIN '+b'PRIVATE KEY-----' in data or b'-----BEGIN '+b'RSA PRIVATE KEY-----' in data: errors.append(name+' (private key)')
    if re.search(rb'(?:gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9]{30,})',data): errors.append(name+' (credential pattern)')
if errors: raise SystemExit('Public source audit failed:\n'+'\n'.join(errors))
print(f'PASS public source audit: {len(list(filter(None,files)))} files; no ISP credentials or private files')
