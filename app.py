#!/usr/bin/env python3
"""
HTTP front-end for the existing raw-TCP chat servers.
Browser  ←→  http://localhost:8080  ←→  app.py  ←→  tcp://localhost:9001|9002
"""
from flask import Flask, request, jsonify, send_from_directory, render_template
import time
import logging
from flask_socketio import SocketIO, emit
# import socket
from client import TCPChatClient
from typing import Dict, List, Tuple, Optional, Any


class ChatFrontend:
    """WebSocket-based HTTP frontend for chat application."""

    def __init__(self, tcp_servers: List[Tuple[str, int]] = None):
        self.tcp_servers = tcp_servers or [
            ('localhost', 9001), ('localhost', 9002)]
        self.tcp_client = TCPChatClient(self.tcp_servers)
        # Create Flask app with proper template folder
        self.app = Flask(__name__,
                         template_folder='templates',
                         static_folder='static')
        self.app.config['SECRET_KEY'] = 'chat-app-secret-key-123'
        self.socketio = SocketIO(self.app,
                                 cors_allowed_origins="*",
                                 logger=False,
                                 engineio_logger=False,)
        self.connected_users = {}
        self._setup_logging()
        self._setup_routes()
        self._setup_socket_handlers()

    def _setup_logging(self):
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger('ChatFrontend')

    def _setup_routes(self):
        @self.app.route('/')
        def index():
            return render_template('index.html')

        @self.app.route('/static/<path:filename>')
        def serve_static(filename):
            return send_from_directory('static', filename)

        @self.app.route('/send', methods=['POST'])
        def send_message():
            try:
                data = request.get_json(force=True)
                username = data.get('username', 'anon').strip()
                text = data.get('text', '').strip()

                if not text:
                    return jsonify({'error': 'Message text cannot be empty'}), 400

                success = self.tcp_client.send_chat_message(username, text)

                if success:
                    # Broadcast to all connected WebSocket clients
                    self.socketio.emit('new_message', {
                        'username': username,
                        'text': text,
                        'timestamp': time.time(),
                        'type': 'chat'
                    })
                    return jsonify({'status': 'ok'})
                else:
                    return jsonify({'error': 'Failed to send message'}), 503

            except Exception as e:
                self.logger.error(f"Error sending message: {e}")
                return jsonify({'error': 'Internal server error'}), 500

        @self.app.route('/health', methods=['GET'])
        def health_check():
            return jsonify({'status': 'healthy', 'timestamp': time.time()})

    def _setup_socket_handlers(self):
        @self.socketio.on('connect')
        def handle_connect():
            self.logger.info(f"WebSocket client connected: {request.sid}")
            # Send current user list
            emit('user_list_update', {
                'users': list(self.connected_users.values())
            }, broadcast=True)

        @self.socketio.on('disconnect')
        def handle_disconnect():
            username = self.connected_users.pop(request.sid, None)
            if username:
                self.logger.info(f"WebSocket client disconnected: {username}")
                # Update user list for all clients
                emit('user_list_update', {
                    'users': list(self.connected_users.values())
                }, broadcast=True)

        @self.socketio.on('user_join')
        def handle_user_join(data):
            username = data.get('username', 'anon').strip()
            self.connected_users[request.sid] = username
            self.logger.info(f"User joined via WebSocket: {username}")

            # Broadcast user list update
            emit('user_list_update', {
                'users': list(self.connected_users.values())
            }, broadcast=True)

            # Broadcast join notification
            emit('user_joined', {
                'username': username,
                'timestamp': time.time()
            }, broadcast=True, include_self=False)

    def run(self, debug: bool = False):
        self.logger.info("Starting WebSocket frontend on port 8080")
        self.logger.info(f"Template folder: {self.app.template_folder}")
        self.logger.info(f"Static folder: {self.app.static_folder}")
        # host = 'localhost' if debug else '0.0.0.0'
        self.socketio.run(self.app, host='0.0.0.0', port=8080,
                          debug=debug, allow_unsafe_werkzeug=True,)


def create_app():
    """Factory function to create the Flask application."""
    return ChatFrontend().app


def main():
    """Main entry point."""
    frontend = ChatFrontend()
    frontend.logger.info("Starting HTTP frontend on port 8080")
    frontend.logger.info(f"Connected to TCP servers: {frontend.tcp_servers}")

    frontend.run(debug=False)


if __name__ == '__main__':
    main()
