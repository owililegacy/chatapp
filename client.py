"""
Chat client – auto-reconnects to any live server.
Usage:  python client.py 9001
        python client.py 9002
"""
import socket
import json
from typing import Dict, List, Tuple, Optional, Any
# Import from our server module to avoid duplication
try:
    from server import ChatMessage, MessageType
except ImportError:
    # Fallback implementation if server module is not available
    pass


class TCPChatClient:
    """TCP client for communicating with chat servers."""

    def __init__(self, servers: List[Tuple[str, int]], timeout: float = 2.0):
        self.servers = servers
        self.timeout = timeout
        self.encoding = 'utf-8'

    def send_message(self, message: ChatMessage) -> Optional[Dict[str, Any]]:
        payload = message.to_dict()
        raw_data = json.dumps(payload).encode(self.encoding)
        packet = len(raw_data).to_bytes(4, 'big') + raw_data

        for host, port in self.servers:
            try:
                with socket.create_connection((host, port), timeout=self.timeout) as sock:
                    sock.sendall(packet)

                    header = sock.recv(4)
                    if not header:
                        continue

                    message_length = int.from_bytes(header, 'big')
                    data = b''
                    while len(data) < message_length:
                        chunk_size = min(4096, message_length - len(data))
                        chunk = sock.recv(chunk_size)
                        if not chunk:
                            break
                        data += chunk

                    if len(data) == message_length:
                        return json.loads(data.decode(self.encoding))

            except Exception:
                continue
        return None

    def ping(self) -> Optional[Dict[str, Any]]:
        ping_message = ChatMessage(type=MessageType.PING)
        return self.send_message(ping_message)

    def send_chat_message(self, username: str, text: str) -> bool:
        chat_message = ChatMessage(
            type=MessageType.CHAT,
            username=username,
            text=text
        )
        response = self.send_message(chat_message)
        return response is not None

