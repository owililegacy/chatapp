"""
Tiny shared helpers between client and server.
"""
import socket
import json
import time

ENC = 'utf-8'
HDR = 4                        # 4-byte header (network order)
BACKUP_PORT = 9003               # inter-server gossip
LOG_FILE = 'logs/message_log.txt'


def send_msg(sock: socket.socket, obj: object) -> None:
    """Send length-prefixed JSON."""
    raw = json.dumps(obj).encode(ENC)
    sock.sendall(len(raw).to_bytes(HDR, 'big') + raw)


def recv_msg(sock: socket.socket) -> object | None:
    """Receive length-prefixed JSON."""
    head = sock.recv(HDR)
    if not head:
        return None
    n = int.from_bytes(head, 'big')
    data = b''
    while len(data) < n:
        packet = sock.recv(n - len(data))
        if not packet:
            return None
        data += packet
    return json.loads(data.decode(ENC))


def now() -> str:
    """Return current time as HH:MM:SS."""
    return time.strftime('%H:%M:%S')
