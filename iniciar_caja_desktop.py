#!/usr/bin/env python3
"""
XenialRest - Inicia la API y abre la app de escritorio (Electron + React).
"""

import os
import sys
import time
import signal
import subprocess
import socket

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
API_DIR = os.path.join(SCRIPT_DIR, "api")
CAJA_DIR = os.path.join(SCRIPT_DIR, "web", "caja-app")

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("localhost", port)) == 0

def kill_process_on_port(port):
    """Intenta liberar el puerto usando npx kill-port."""
    try:
        r = subprocess.run(
            ["npx", "-y", "kill-port", str(port)],
            cwd=CAJA_DIR,
            capture_output=True,
            text=True,
            timeout=10,
        )
        if r.returncode == 0:
            time.sleep(1)
            return True
    except Exception:
        pass
    return False

def main():
    if not os.path.exists(os.path.join(API_DIR, "package.json")):
        print("Error: No se encuentra api/package.json")
        sys.exit(1)

    if not os.path.exists(os.path.join(CAJA_DIR, "package.json")):
        print("Error: No se encuentra web/caja-app/package.json")
        sys.exit(1)

    server = None
    if is_port_in_use(3000):
        print("Reiniciando API para cargar rutas actualizadas...")
        kill_process_on_port(3000)
        time.sleep(2)
    print("Iniciando XenialRest API...")
    server = subprocess.Popen("npm start", cwd=API_DIR, shell=True)
    print("Esperando servidor...")
    time.sleep(3)

    # Liberar puerto 5180 siempre antes de iniciar (evita errores de instancias previas)
    if is_port_in_use(5180):
        print("Liberando puerto 5180...")
        kill_process_on_port(5180)
        time.sleep(2)
        if is_port_in_use(5180):
            print("Error: No se pudo liberar el puerto 5180. Cierra la app y vuelve a intentar.")
            if server:
                server.terminate()
            sys.exit(1)

    print("Iniciando app de escritorio...")
    electron = subprocess.Popen("npm run electron:dev", cwd=CAJA_DIR, shell=True)

    def cleanup_all(signum=None, frame=None):
        print("\nCerrando...")
        electron.terminate()
        if server:
            server.terminate()
        try:
            electron.wait(timeout=5)
        except subprocess.TimeoutExpired:
            electron.kill()
        if server:
            try:
                server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server.kill()
        sys.exit(0)

    signal.signal(signal.SIGINT, cleanup_all)
    signal.signal(signal.SIGTERM, cleanup_all)

    print("App en ejecución. Pulsa Ctrl+C para cerrar.")
    electron.wait()
    if server:
        server.terminate()

if __name__ == "__main__":
    main()
