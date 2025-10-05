"""
Chat client – auto-reconnects to any live server.
Usage:  python client.py 9001
        python client.py 9002
"""
import socket
import threading
import sys
import time
from common import send_msg, tcp_send_recv

SERVERS = [('localhost', 9001), ('localhost', 9002)]
USERNAME = input('Enter username: ') or 'anon'


def connect_any_server():
    for host, port in SERVERS:
        try:
            s = socket.create_connection((host, port), timeout=2)
            s.settimeout(None)  # <-- Add this line
            return s, port
        except Exception:
            continue
    print('No server reachable – retrying in 3 s')
    time.sleep(3)
    return connect_any_server()


def recv_loop(sock):
    while True:
        msg = tcp_send_recv(sock)
        if not msg:
            print('\n[Lost server – reconnecting…]')
            return
        print(msg['text'])  # type: ignore


def main():
    while True:
        sock, port = connect_any_server()
        print(f'Connected to server port {port}')
        send_msg(sock, {'username': USERNAME})
        threading.Thread(target=recv_loop, args=(sock,), daemon=True).start()
        while True:
            try:
                txt = input()
                send_msg(sock, {'type': 'chat', 'text': txt})
            except (EOFError, KeyboardInterrupt):
                return


if __name__ == '__main__':
    main()
