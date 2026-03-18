#!/usr/bin/env python3
"""
Importa platos y bebidas desde un PDF de carta al restaurante.
1. Extrae texto del PDF
2. Parsea platos/bebidas con precios
3. Guarda JSON para revisión
4. Opcional: importa a BD (platos)

Uso: python importar_carta_pdf.py [--importar] [ruta_pdf]
"""

import re
import sys
import json
import argparse
from pathlib import Path

try:
    from pypdf import PdfReader
except ImportError:
    print("Instala pypdf: pip install pypdf")
    sys.exit(1)

# Mapeo sección PDF -> curso (entrante, primero, segundo, tercero, cuarto)
# Solo títulos de sección, no descripciones
SECCIONES = {
    "PER PICAR": "entrante",
    "COMPARTIR": "entrante",
    "AMANIDES": "entrante",
    "VERDURES": "entrante",
    "ARROSSOS": "segundo",
    "AR R OS S OS": "segundo",
    "MAR A LA TAULA": "segundo",
    "PLATS PETITS": "segundo",
    "PL ATS P E TI TS": "segundo",
    "CARNS": "segundo",
    "BRASA": "segundo",
    "SUPLEMENTS": "entrante",
    "BLANCOS": "cuarto",
    "WHITE WINE": "cuarto",
    "ROSADOS": "cuarto",
    "PINK WINE": "cuarto",
    "TINTOS": "cuarto",
    "RED WINE": "cuarto",
    "cava": "cuarto",  # sección vinos
}


def extraer_texto(pdf_path):
    """Extrae todo el texto del PDF."""
    reader = PdfReader(pdf_path)
    return "\n".join(p.extract_text() or "" for p in reader.pages)


def parsear_carta(texto):
    """
    Parsea el texto extraído para obtener platos/bebidas con precios.
    Busca: líneas con texto (nombre) seguidas de precio, o nombre y precio en misma línea.
    """
    lineas = [l.strip() for l in texto.split("\n") if l.strip()]
    items = []
    precio_re = re.compile(r"(\d+)[.,](\d+)\s*€?")
    solo_precio_re = re.compile(r"^\s*(\d+)[.,](\d+)\s*€?\s*$")
    curso_actual = "segundo"

    i = 0
    while i < len(lineas):
        linea = lineas[i]

        # Detectar cambio de sección
        for seccion, curso in SECCIONES.items():
            if seccion.upper() in linea.upper() and len(linea) < 60:
                curso_actual = curso
                break

        # Caso 1: Línea con solo precio -> nombre en la anterior
        match_solo = solo_precio_re.match(linea)
        if match_solo and i > 0:
            precio = float(f"{match_solo.group(1)}.{match_solo.group(2)}")
            nombre = lineas[i - 1]
            if _es_nombre_valido(nombre) and precio < 200:
                items.append(_crear_item(nombre, precio, curso_actual))
            i += 1
            continue

        # Caso 2: Nombre y precio en la misma línea (precio al final)
        matches = list(precio_re.finditer(linea))
        if matches:
            # Usar el ÚLTIMO precio (el que corresponde al plato)
            last = matches[-1]
            precio = float(f"{last.group(1)}.{last.group(2)}")
            nombre = linea[: last.start()].strip()
            if not nombre and i > 0:
                nombre = lineas[i - 1]
            if _es_nombre_valido(nombre) and precio < 200:
                items.append(_crear_item(nombre, precio, curso_actual))
        i += 1

    return items


def _es_nombre_valido(nombre):
    """Comprueba si parece un nombre de plato válido."""
    nombre = re.sub(r"\s+", " ", nombre).strip(".-, ")
    if not nombre or len(nombre) < 4:
        return False
    if re.match(r"^[\d\s,\.€]+$", nombre):  # Solo números
        return False
    if re.match(r"^DO\s|^Variedad|^\d+M\s|viñas viejas", nombre, re.I):
        return False
    # Excluir títulos de sección y avisos
    excluir = ["D E L MAR", "MAR A LA TAULA", "PICAR", "COMPARTIR", "ARROSSOS", "PLATS PETITS",
               "CARNS", "BRASA", "SUPLEMENTS", "ALÉRGENOS", "ALERGENOS", "GUARNICIÓN",
               "INFORMI", "PERSONAL", "TOTS ELS", "PER PODER", "TEMPS D", "ELS NOSTRES",
               "FEM SERVIR", "PER A GARANTIR", "RECOMANEM", "TRACTEM"]
    for ex in excluir:
        if ex in nombre.upper() and len(nombre) < 40:
            return False
    return True


def _crear_item(nombre, precio, curso):
    # Quitar precios al inicio (ej. "21,9€Paella..." -> "Paella...")
    nombre = re.sub(r"^[\d\s,\.€]+\s*", "", nombre)
    nombre = re.sub(r"\s+", " ", nombre).strip(".-, ")[:150]
    return {"nombre": nombre, "precio_base": round(precio, 2), "curso": curso}


def main():
    parser = argparse.ArgumentParser(description="Importar carta PDF a platos")
    parser.add_argument("--importar", action="store_true", help="Importar a BD después de extraer")
    parser.add_argument(
        "pdf",
        nargs="?",
        default=Path(__file__).parent / "Mar de pins" / "ESTIU_2025_CARTA.pdf",
        help="Ruta al PDF",
    )
    args = parser.parse_args()

    pdf_path = Path(args.pdf)
    if not pdf_path.exists():
        print(f"Error: No existe {pdf_path}")
        sys.exit(1)

    print(f"Extrayendo texto de {pdf_path}...")
    texto = extraer_texto(pdf_path)
    print(f"Texto extraído: {len(texto)} caracteres")

    items = parsear_carta(texto)
    print(f"\nEncontrados {len(items)} platos/bebidas:\n")

    # Agrupar por curso
    por_curso = {}
    for it in items:
        c = it["curso"]
        por_curso.setdefault(c, []).append(it)

    for curso in ["entrante", "primero", "segundo", "tercero", "cuarto"]:
        if curso in por_curso:
            print(f"  {curso.upper()}: {len(por_curso[curso])} items")
            for it in por_curso[curso][:5]:
                print(f"    - {it['nombre'][:50]}... {it['precio_base']}€")
            if len(por_curso[curso]) > 5:
                print(f"    ... y {len(por_curso[curso]) - 5} más")

    # Guardar JSON para revisión/import
    out_json = Path(__file__).parent / "carta_importar.json"
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
    print(f"\nGuardado en {out_json} para revisión.")

    if args.importar:
        print("\nImportando a BD...")
        import subprocess
        r = subprocess.run(
            ["node", "api/importar-platos.js", str(out_json)],
            cwd=Path(__file__).parent.parent,
        )
        sys.exit(r.returncode)
    else:
        print("\nPara importar a la BD: python importar_carta_pdf.py --importar")


if __name__ == "__main__":
    main()
