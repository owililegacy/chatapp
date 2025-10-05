#!/usr/bin/env python3
"""
HTTP front-end for the existing raw-TCP chat servers.
Browser  ←→  http://localhost:8080  ←→  app.py  ←→  tcp://localhost:9001|9002
"""
from flask import Flask, request, jsonify, send_from_directory, render_template
import time
import logging
from client import TCPChatClient
from typing import Dict, List, Tuple, Optional, Any


class ChatFrontend:
    """Lightweight HTTP frontend for chat application."""

    def __init__(self, tcp_servers: List[Tuple[str, int]] = None):
        self.tcp_servers = tcp_servers or [
            ('localhost', 8001), ('localhost', 8002)]
        self.tcp_client = TCPChatClient(self.tcp_servers)
        self.app = Flask(__name__)
        self._setup_logging()
        self._setup_routes()

    def _setup_logging(self):
        """Setup application logging."""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger('ChatFrontend')

    def _setup_routes(self):
        """Setup Flask routes."""

        @self.app.route('/')
        def index():
            """Serve the main chat interface."""
            self.logger.info("Serving chat interface")
            return render_template('index.html')

        @self.app.route('/static/<path:filename>')
        def serve_static(filename):
            """Serve static files."""
            return send_from_directory('static', filename)

        @self.app.route('/send', methods=['POST'])
        def send_message():
            """Handle sending chat messages."""
            try:
                data = request.get_json(force=True)
                username = data.get('username', 'anon').strip()
                text = data.get('text', '').strip()

                if not text:
                    return jsonify({'error': 'Message text cannot be empty'}), 400

                if not username:
                    username = 'anon'

                success = self.tcp_client.send_chat_message(username, text)

                if success:
                    self.logger.info(f"Message sent from {username}")
                    return jsonify({'status': 'ok'})
                else:
                    return jsonify({'error': 'Failed to send message - servers unavailable'}), 503

            except Exception as e:
                self.logger.error(f"Error sending message: {e}")
                return jsonify({'error': 'Internal server error'}), 500

        @self.app.route('/poll', methods=['GET'])
        def poll_messages():
            """Poll for new messages and user joins."""
            try:
                # Get response from TCP server (ping to get latest activity)
                response = self.tcp_client.ping()

                # Return the response or empty object
                return jsonify(response or {})

            except Exception as e:
                self.logger.error(f"Error polling messages: {e}")
                return jsonify({'error': 'Polling failed'}), 500

        @self.app.route('/health', methods=['GET'])
        def health_check():
            """Health check endpoint."""
            try:
                response = self.tcp_client.ping()
                status = 'healthy' if response else 'unhealthy'
                return jsonify({
                    'status': status,
                    'timestamp': time.time(),
                    'servers': len(self.tcp_servers)
                })
            except Exception as e:
                return jsonify({'status': 'error', 'error': str(e)}), 500


def create_app():
    """Factory function to create the Flask application."""
    frontend = ChatFrontend()
    return frontend.app


def main():
    """Main entry point."""
    frontend = ChatFrontend()
    frontend.logger.info(f"Starting HTTP frontend on port 8080")
    frontend.logger.info(f"Connected to TCP servers: {frontend.tcp_servers}")

    frontend.app.run(host='0.0.0.0', port=8080, debug=True)


if __name__ == '__main__':
    main()
