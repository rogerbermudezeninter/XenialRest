#!/usr/bin/env python3
"""
XenialRest - Inicia la API y abre el módulo caja en el navegador.
"""

import os
import sys
import time
import signal
import webbrowser
import subprocess

# Directorio del proyecto
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
API_DIR = os.path.join(SCRIPT_DIR, "api")
URL_CAJA = "http://localhost:3000/caja/"

def main():
    # Comprobar que existe api/package.json
    if not os.path.exists(os.path.join(API_DIR, "package.json")):
        print("Error: No se encuentra api/package.json")
        sys.exit(1)

    print("Iniciando XenialRest API...")
    server = subprocess.Popen(
        "npm start",
        cwd=API_DIR,
        shell=True,
    )

    def cleanup(signum=None, frame=None):
        print("\nCerrando servidor...")
        server.terminate()
        server.wait()
        sys.exit(0)

    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    # Esperar a que el servidor arranque
    print("Esperando servidor...")
    time.sleep(3)

    print("Abriendo navegador en", URL_CAJA)
    webbrowser.open(URL_CAJA)

    print("Servidor en ejecución. Pulsa Ctrl+C para cerrar.")
    server.wait()

if __name__ == "__main__":
    main()
