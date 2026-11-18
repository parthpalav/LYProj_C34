"""
Production entry point for the ML service (no Flask debugger, no reloader):

    cd ml-service && gunicorn --workers 1 --threads 4 --bind 127.0.0.1:5001 wsgi:app

Bind a public interface only behind a firewall or reverse proxy; the API server
is the only client and reaches it on loopback.
"""
from api import app, prepare_classifier

prepare_classifier()
