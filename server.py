"""
Multi-node chat server.
Run:  python server.py 9001   # first node
python server.py 9002   # second node
"""
import socket
import threading
import sys
import os
import time
from common import *
PEERS = [('localhost', 9001), ('localhost', 9002)]
MY_PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9001
PEERS = [p for p in PEERS if p[1] != MY_PORT]
clients = {}               # sock -> username
lock = threading.Lock()


def log(message):
    os.makedirs('logs', exist_ok=True)
    with open(LOG_FILE, 'a', encoding=ENC) as f:
        f.write(message + '\n')


def broadcast_to_clients(msg_obj, skip_sock=None):
    raw = json.dumps(msg_obj).encode(ENC)
    with lock:
        socks = list(clients.keys())
        for sock in socks:
            if sock is skip_sock:
                continue
            try:
                send_msg(sock, msg_obj)
            except:
                drop_client(sock)


def drop_client(sock):
    with lock:
        name = clients.pop(sock, '<gone>')
    broadcast_to_clients({'type': 'system', 'text': f'{name} left'})
    sock.close()


def handle_client(sock, addr):
    msg = recv_msg(sock)
    if not msg or not isinstance(msg, dict):
        name = 'anon'
    else:
        name = msg.get('username', 'anon')
    with lock:
        clients[sock] = name
    broadcast_to_clients({'type': 'system', 'text': f'{name} joined'})
    while True:
        msg = recv_msg(sock)
        if not msg or not isinstance(msg, dict):
            drop_client(sock)
            break
        if msg.get('type') == 'chat':
            txt = f"{now()} {name}: {msg.get('text', '')}"
            log(txt)
            broadcast_to_clients({'type': 'chat', 'text': txt})
            # also gossip to peer servers
            gossip({'type': 'gossip', 'text': txt})


def gossip(obj):
    for host, port in PEERS:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.connect((host, port))
            send_msg(s, obj)
            s.close()
        except:
            pass   # peer down – ignore


def peer_listener():
    srv = socket.socket()
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(('0.0.0.0', BACKUP_PORT))
    srv.listen(5)
    while True:
        sock, _ = srv.accept()
        threading.Thread(target=peer_handler, args=(
            sock,), daemon=True).start()


def peer_handler(sock):
    msg = recv_msg(sock)
    if isinstance(msg, dict) and msg.get('type') == 'gossip':
        txt = msg.get('text', '')
        log(txt)
        broadcast_to_clients({'type': 'chat', 'text': txt})
    sock.close()


def main():
    threading.Thread(target=peer_listener, daemon=True).start()
    srv = socket.socket()
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(('0.0.0.0', MY_PORT))
    srv.listen(10)
    print(f'Server on port {MY_PORT} ready')
    while True:
        sock, addr = srv.accept()
        threading.Thread(target=handle_client, args=(
            sock, addr), daemon=True).start()


if __name__ == '__main__':
    main()
