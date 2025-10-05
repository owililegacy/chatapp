#!/usr/bin/env python3
"""
Multi-node chat server - Object-Oriented Implementation.
Run:  python server.py 9001   # first node
      python server.py 9002   # second node
"""
import socket
import threading
import sys
import os
import time
import json
import logging
from typing import Dict, Set, List, Tuple, Optional, Any
from dataclasses import dataclass
from enum import Enum


class MessageType(Enum):
    CHAT = "chat"
    SYSTEM = "system"
    GOSSIP = "gossip"
    PING = "ping"
    JOIN = "join"
    LEAVE = "leave"


@dataclass
class ChatMessage:
    type: MessageType
    username: str = "Anonymous"
    text: str = ""
    timestamp: float = None
    source_port: int = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = time.time()
        if isinstance(self.type, str):
            self.type = MessageType(self.type)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'type': self.type.value,
            'username': self.username,
            'text': self.text,
            'timestamp': self.timestamp,
            'source_port': self.source_port
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ChatMessage':
        return cls(
            type=MessageType(data.get('type', 'chat')),
            username=data.get('username', 'anon'),
            text=data.get('text', ''),
            timestamp=data.get('timestamp', time.time()),
            source_port=data.get('source_port')
        )


class ChatClient:
    """Represents a connected chat client."""

    def __init__(self, socket: socket.socket, address: Tuple[str, int], username: str = "anon"):
        self.socket = socket
        self.address = address
        self.username = username
        self.connected = True
        self.last_activity = time.time()

    def send(self, message: ChatMessage) -> bool:
        """Send message to client."""
        try:
            data = json.dumps(message.to_dict()).encode('utf-8')
            packet = len(data).to_bytes(4, 'big') + data
            self.socket.sendall(packet)
            self.last_activity = time.time()
            return True
        except (socket.error, ConnectionError, OSError):
            self.connected = False
            return False

    def close(self):
        """Close client connection."""
        try:
            self.socket.close()
        except Exception:
            pass
        self.connected = False


class ChatServer:
    """Multi-node chat server implementation."""

    # Constants
    ENCODING = 'utf-8'
    BACKUP_PORT = 9999  # For inter-server communication
    LOG_FILE = 'logs/chat_server.log'

    def __init__(self, port: int = 9001, peers: List[Tuple[str, int]] = None):
        self.port = port
        self.peers = peers or []
        self.clients: Dict[ChatClient, str] = {}
        self.lock = threading.RLock()
        self.running = False
        self.server_socket: Optional[socket.socket] = None
        self.peer_socket: Optional[socket.socket] = None

        # Filter out self from peers
        self.peers = [p for p in self.peers if p[1] != self.port]

        # Setup logging
        self._setup_logging()

    def _setup_logging(self):
        """Setup logging configuration."""
        os.makedirs('logs', exist_ok=True)
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(self.LOG_FILE, encoding=self.ENCODING),
                logging.StreamHandler(sys.stdout)
            ]
        )
        self.logger = logging.getLogger(f'ChatServer-{self.port}')

    def log_message(self, message: str):
        """Log chat message to file."""
        timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
        log_entry = f"{timestamp} - {message}"
        try:
            with open(self.LOG_FILE, 'a', encoding=self.ENCODING) as f:
                f.write(log_entry + '\n')
        except IOError as e:
            self.logger.error(f"Failed to write to log file: {e}")

    def broadcast_message(self, message: ChatMessage, exclude_client: Optional[ChatClient] = None):
        """
        Broadcast message to all connected clients.

        Args:
            message: Message to broadcast
            exclude_client: Client to exclude from broadcast (usually sender)
        """
        message.source_port = self.port

        with self.lock:
            disconnected_clients = []

            for client in list(self.clients.keys()):
                if client is exclude_client or not client.connected:
                    if not client.connected:
                        disconnected_clients.append(client)
                    continue

                if not client.send(message):
                    disconnected_clients.append(client)

            # Clean up disconnected clients
            for client in disconnected_clients:
                self._remove_client(client)

    def _remove_client(self, client: ChatClient):
        """Remove client and notify others."""
        with self.lock:
            if client in self.clients:
                username = self.clients[client]
                del self.clients[client]
                client.close()

                # Notify other clients
                leave_message = ChatMessage(
                    type=MessageType.SYSTEM,
                    text=f"{username} left the chat"
                )
                self.broadcast_message(leave_message)
                self.logger.info(
                    f"Client disconnected: {username} from {client.address}")

    def handle_client_connection(self, client_socket: socket.socket, client_address: Tuple[str, int]):
        """Handle individual client connection."""
        client = None
        try:
            # Receive initial join message
            initial_message = self._receive_message(client_socket)
            if not initial_message:
                return

            username = initial_message.username
            client = ChatClient(client_socket, client_address, username)

            # Add client to connected clients
            with self.lock:
                self.clients[client] = username

            # Notify everyone about new user
            join_message = ChatMessage(
                type=MessageType.SYSTEM,
                text=f"{username} joined the chat"
            )
            self.broadcast_message(join_message)
            self.logger.info(
                f"New client connected: {username} from {client_address}")

            # Handle subsequent messages from client
            while client.connected:
                message = self._receive_message(client_socket, timeout=1.0)
                if message:
                    if message.type == MessageType.CHAT:
                        # Log and broadcast chat message
                        log_text = f"{username}: {message.text}"
                        self.log_message(log_text)

                        chat_message = ChatMessage(
                            type=MessageType.CHAT,
                            username=username,
                            text=message.text
                        )
                        self.broadcast_message(
                            chat_message, exclude_client=client)

                        # Gossip to peer servers
                        self._gossip_to_peers(chat_message)

                    elif message.type == MessageType.PING:
                        # Respond to ping
                        ping_response = ChatMessage(
                            type=MessageType.PING, text="pong")
                        client.send(ping_response)

        except (socket.error, ConnectionError, OSError, json.JSONDecodeError) as e:
            self.logger.warning(f"Client handling error: {e}")
        finally:
            if client:
                self._remove_client(client)

    def _receive_message(self, sock: socket.socket, timeout: Optional[float] = None) -> Optional[ChatMessage]:
        """Receive a message from socket."""
        try:
            if timeout:
                sock.settimeout(timeout)

            # Read message length
            header = sock.recv(4)
            if not header:
                return None

            message_length = int.from_bytes(header, 'big')

            # Read message data
            data = b''
            while len(data) < message_length:
                chunk = sock.recv(min(4096, message_length - len(data)))
                if not chunk:
                    return None
                data += chunk

            # Parse message
            message_dict = json.loads(data.decode(self.ENCODING))
            return ChatMessage.from_dict(message_dict)

        except socket.timeout:
            return None
        except (socket.error, ConnectionError, OSError, json.JSONDecodeError, ValueError):
            return None

    def _gossip_to_peers(self, message: ChatMessage):
        """Send message to peer servers."""
        if not self.peers:
            return

        gossip_message = ChatMessage(
            type=MessageType.GOSSIP,
            username=message.username,
            text=message.text,
            source_port=self.port
        )

        for host, port in self.peers:
            try:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as peer_socket:
                    peer_socket.settimeout(2.0)
                    peer_socket.connect((host, port))
                    self._send_message(peer_socket, gossip_message)
            except (socket.error, ConnectionError, OSError, TimeoutError):
                self.logger.debug(f"Could not connect to peer {host}:{port}")

    def _send_message(self, sock: socket.socket, message: ChatMessage):
        """Send message to socket."""
        data = json.dumps(message.to_dict()).encode(self.ENCODING)
        packet = len(data).to_bytes(4, 'big') + data
        sock.sendall(packet)

    def handle_peer_connection(self, peer_socket: socket.socket, peer_address: Tuple[str, int]):
        """Handle incoming connection from peer server."""
        try:
            message = self._receive_message(peer_socket)
            if message and message.type == MessageType.GOSSIP:
                # Re-broadcast gossip message to clients
                chat_message = ChatMessage(
                    type=MessageType.CHAT,
                    username=message.username,
                    text=message.text
                )
                self.broadcast_message(chat_message)
                self.log_message(f"{message.username}: {message.text}")

        except (socket.error, ConnectionError, OSError, json.JSONDecodeError) as e:
            self.logger.debug(f"Peer connection error: {e}")
        finally:
            try:
                peer_socket.close()
            except:
                pass

    def start_peer_listener(self):
        """Start listening for connections from peer servers."""
        try:
            self.peer_socket = socket.socket(
                socket.AF_INET, socket.SOCK_STREAM)
            self.peer_socket.setsockopt(
                socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.peer_socket.bind(('0.0.0.0', self.BACKUP_PORT))
            self.peer_socket.listen(5)
            self.peer_socket.settimeout(1.0)

            self.logger.info(
                f"Peer listener started on port {self.BACKUP_PORT}")

            while self.running:
                try:
                    peer_sock, peer_addr = self.peer_socket.accept()
                    threading.Thread(
                        target=self.handle_peer_connection,
                        args=(peer_sock, peer_addr),
                        daemon=True
                    ).start()
                except socket.timeout:
                    continue

        except Exception as e:
            self.logger.error(f"Peer listener error: {e}")
        finally:
            if self.peer_socket:
                self.peer_socket.close()

    def start(self):
        """Start the chat server."""
        self.running = True

        # Start peer listener thread
        peer_thread = threading.Thread(
            target=self.start_peer_listener, daemon=True)
        peer_thread.start()

        # Start main server socket
        try:
            self.server_socket = socket.socket(
                socket.AF_INET, socket.SOCK_STREAM)
            self.server_socket.setsockopt(
                socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.server_socket.bind(('0.0.0.0', self.port))
            self.server_socket.listen(10)
            self.server_socket.settimeout(1.0)

            self.logger.info(f"Chat server started on port {self.port}")
            self.logger.info(f"Known peers: {self.peers}")

            while self.running:
                try:
                    client_socket, client_address = self.server_socket.accept()
                    threading.Thread(
                        target=self.handle_client_connection,
                        args=(client_socket, client_address),
                        daemon=True
                    ).start()
                except socket.timeout:
                    continue

        except Exception as e:
            self.logger.error(f"Server error: {e}")
        finally:
            self.stop()

    def stop(self):
        """Stop the chat server."""
        self.running = False

        # Close all client connections
        with self.lock:
            for client in list(self.clients.keys()):
                client.close()
            self.clients.clear()

        # Close server sockets
        if self.server_socket:
            self.server_socket.close()
        if self.peer_socket:
            self.peer_socket.close()

        self.logger.info("Chat server stopped")


def main():
    """Main entry point."""
    if len(sys.argv) < 2:
        print("Usage: python server.py <port> [peer_port1] [peer_port2] ...")
        sys.exit(1)

    try:
        port = int(sys.argv[1])
        peers = [('localhost', int(p)) for p in sys.argv[2:]]

        server = ChatServer(port=port, peers=peers)

        # Handle graceful shutdown
        def signal_handler(signum, frame):
            print("\nShutting down server...")
            server.stop()
            sys.exit(0)

        # Register signal handlers for graceful shutdown
        import signal
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

        server.start()

    except ValueError:
        print("Error: Port must be a valid integer")
        sys.exit(1)
    except Exception as e:
        print(f"Error starting server: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
