#!/usr/bin/env python3
"""
HTTP front-end for the existing raw-TCP chat servers.
Browser  ←→  http://localhost:8080  ←→  app.py  ←→  tcp://localhost:9001|9002
"""
from flask import Flask, request, jsonify, send_from_directory, render_template
import socket
import json
import threading
import queue
import time

app = Flask(__name__)
TCP_SERVERS = [('localhost', 9001), ('localhost', 9002)]


@app.route('/static/<path:filename>')
def serve_files(filename):
    return send_from_directory('static', filename)

# ---------- tiny TCP client -------------------------------------------------


def tcp_send_recv(payload_dict):
    """Open TCP, send one message, return one reply (or None)."""
    raw_out = json.dumps(payload_dict).encode()
    pkt = len(raw_out).to_bytes(4, 'big') + raw_out
    for host, port in TCP_SERVERS:
        try:
            with socket.create_connection((host, port), timeout=2) as s:
                s.sendall(pkt)
                # read one reply
                hdr = s.recv(4)
                if not hdr:
                    continue
                n = int.from_bytes(hdr, 'big')
                data = b''
                while len(data) < n:
                    chunk = s.recv(n - len(data))
                    if not chunk:
                        break
                    data += chunk
                return json.loads(data.decode())
        except Exception:
            continue
    return None
# ----------------------------------------------------------------------------

# ---------- HTTP routes ------------------------------------------------------


@app.route('/', methods=['GET'])
def index():
    print("serving")
    return render_template('index.html')


@app.route('/send', methods=['POST'])
def send_msg():
    """Browser posts {username: '..', text: '..'}"""
    body = request.get_json(force=True)
    tcp_send_recv({'username': body.get('username', 'anon'),
                   'type': 'chat', 'text': body.get('text', '')})
    return jsonify(status='ok')


@app.route('/poll', methods=['GET'])
def poll():
    """Very small long-poll: returns last chat line server echoed."""
    # ask server for “the last thing it said to us”
    resp = tcp_send_recv({'type': 'ping'})
    return jsonify(resp or {})
# ----------------------------------------------------------------------------


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
