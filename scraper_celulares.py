import argparse
import json
import re
import time
from typing import Any
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.gsmarena.com/"

MARCAS = [
    ("Samsung", "https://www.gsmarena.com/samsung-phones-9.php"),
    ("Apple", "https://www.gsmarena.com/apple-phones-48.php"),
    ("Xiaomi", "https://www.gsmarena.com/xiaomi-phones-80.php"),
    ("Motorola", "https://www.gsmarena.com/motorola-phones-4.php"),
    ("Google", "https://www.gsmarena.com/google-phones-107.php"),
    ("OnePlus", "https://www.gsmarena.com/oneplus-phones-95.php"),
]

PALABRAS_EXCLUIDAS = ("tab", "ipad", "pad", "watch", "band", "buds", "pixel book")

TASAS_A_MXN = {
    "MXN": 1.0,
    "USD": 20.0,
    "EUR": 21.5,
    "GBP": 25.0,
    "INR": 0.24,
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
}


def obtener_html(session: requests.Session, url: str, espera: float = 0.8) -> BeautifulSoup | None:
    """Descarga una página y devuelve el objeto BeautifulSoup, o None si falla."""
    for intento in range(3):
        time.sleep(espera)
        try:
            resp = session.get(url, headers=HEADERS, timeout=15)
            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", 5 * (intento + 1)))
                print(f"  [!] Límite de peticiones (429) en {url}, esperando {retry_after}s...")
                time.sleep(retry_after)
                continue
            resp.raise_for_status()
            return BeautifulSoup(resp.text, "html.parser")
        except requests.RequestException as exc:
            print(f"  [!] Error al consultar {url}: {exc}")
            if intento < 2:
                time.sleep(2 * (intento + 1))
    return None


def parsear_precio_mxn(texto_precio: str | None) -> float | None:
   
    if not texto_precio:
        return None

    patrones = [
        (r"\$\s*([\d,]+(?:\.\d+)?)", "USD"),
        (r"([\d,]+(?:\.\d+)?)\s*USD", "USD"),
        (r"€\s*([\d,]+(?:\.\d+)?)", "EUR"),
        (r"([\d,]+(?:\.\d+)?)\s*EUR", "EUR"),
        (r"£\s*([\d,]+(?:\.\d+)?)", "GBP"),
        (r"([\d,]+(?:\.\d+)?)\s*GBP", "GBP"),
        (r"₹\s*([\d,]+(?:\.\d+)?)", "INR"),
        (r"([\d,]+(?:\.\d+)?)\s*INR", "INR"),
    ]

    for patron, moneda in patrones:
        match = re.search(patron, texto_precio, re.IGNORECASE)
        if match:
            monto = float(match.group(1).replace(",", ""))
            return round(monto * TASAS_A_MXN[moneda], 2)

    return None


def extraer_spec(soup: BeautifulSoup, spec_name: str) -> str:
    """Obtiene el texto limpio de un atributo data-spec."""
    el = soup.select_one(f'[data-spec="{spec_name}"]')
    if not el:
        return ""
    return re.sub(r"\s+", " ", el.get_text(" ", strip=True)).strip()


def obtener_imagenes_galeria(
    session: requests.Session,
    detalle: BeautifulSoup,
    imagen_principal: str,
) -> list[str]:
    """Obtiene las fotos oficiales de distintos colores desde la página -pictures-."""
    imagenes: list[str] = []
    link_fotos = detalle.select_one('.specs-photo-main a[href*="-pictures-"], a[href*="-pictures-"]')

    if link_fotos and link_fotos.get("href"):
        url_fotos = urljoin(BASE_URL, link_fotos["href"])
        soup_fotos = obtener_html(session, url_fotos, espera=0.5)
        if soup_fotos:
            contenedor = soup_fotos.select_one("#pictures-list")
            if contenedor:
                encabezados_vistos = 0
                for nodo in contenedor.find_all(["h2", "img"]):
                    if nodo.name == "h2":
                        encabezados_vistos += 1
                        # Evita mezclar muestras de cámara que aparecen en secciones posteriores
                        if encabezados_vistos > 1:
                            break
                        continue

                    src = nodo.get("data-src") or nodo.get("src") or ""
                    if not src or src.startswith("data:"):
                        continue

                    url_img = urljoin(BASE_URL, src)
                    if "/vv/pics/" in url_img and url_img not in imagenes:
                        imagenes.append(url_img)

    if not imagenes and imagen_principal:
        imagenes.append(imagen_principal)

    return imagenes


def construir_disenos(colors_text: str, imagenes: list[str]) -> list[dict[str, str]]:
    """Asigna una imagen distinta a cada edición/color disponible."""
    if not imagenes:
        return [{"nombre": "Edición Standard", "imagen": ""}]

    if colors_text:
        colores = [c.strip() for c in colors_text.split(",") if c.strip()][:3]
        if colores:
            return [
                {
                    "nombre": f"Edición {color}",
                    "imagen": imagenes[idx % len(imagenes)],
                }
                for idx, color in enumerate(colores)
            ]

    return [{"nombre": "Edición Standard", "imagen": imagenes[0]}]


def scrape_marca(
    session: requests.Session,
    marca: str,
    url_marca: str,
    objetivo: int,
    urls_vistas: set[str] | None = None,
) -> list[dict[str, Any]]:
    """Extrae hasta `objetivo` celulares de una marca en GSMArena."""
    print(f"Consultando {marca}: {url_marca}")
    soup = obtener_html(session, url_marca, espera=0.4)
    if not soup:
        return []

    resultados: list[dict[str, Any]] = []
    vistas = urls_vistas if urls_vistas is not None else set()
    items = soup.select(".makers li")

    for li in items:
        if len(resultados) >= objetivo:
            break

        enlace = li.select_one("a")
        img_lista = li.select_one("img")
        if not enlace or not enlace.get("href"):
            continue

        nombre_corto = li.get_text(" ", strip=True)
        nombre_lower = nombre_corto.lower()
        if any(p in nombre_lower for p in PALABRAS_EXCLUIDAS):
            continue

        url_detalle = urljoin(BASE_URL, enlace["href"])
        if url_detalle in vistas:
            continue

        imagen_lista = img_lista.get("src", "") if img_lista else ""
        resumen_lista = img_lista.get("title", "") if img_lista else ""

        detalle = obtener_html(session, url_detalle, espera=0.7)
        if not detalle:
            continue

        precio_raw = extraer_spec(detalle, "price")
        precio_mxn = parsear_precio_mxn(precio_raw)
        if precio_mxn is None:
            continue

        vistas.add(url_detalle)
        nombre_completo = extraer_spec(detalle, "modelname") or f"{marca} {nombre_corto}"
        pantalla = extraer_spec(detalle, "displaysize") or extraer_spec(detalle, "displaytype")
        procesador = extraer_spec(detalle, "chipset")
        memoria = extraer_spec(detalle, "internalmemory")
        camara = extraer_spec(detalle, "cam1modules")
        bateria = extraer_spec(detalle, "batdescription1")
        colores = extraer_spec(detalle, "colors")

        img_detalle = detalle.select_one(".specs-photo-main img")
        imagen_principal = (img_detalle.get("src") if img_detalle else "") or imagen_lista
        imagenes_galeria = obtener_imagenes_galeria(session, detalle, imagen_principal)

        partes_desc = []
        if pantalla:
            partes_desc.append(f"Pantalla {pantalla.split(',')[0]}")
        if procesador:
            partes_desc.append(f"procesador {procesador}")
        if memoria:
            partes_desc.append(f"almacenamiento {memoria.split(',')[0]}")
        if camara:
            partes_desc.append(f"cámara {camara.split(',')[0]}")
        if bateria:
            partes_desc.append(f"batería {bateria}")

        descripcion = (
            f"Smartphone {nombre_completo}. " + ", ".join(partes_desc) + "."
            if partes_desc
            else (resumen_lista or f"Smartphone {nombre_completo} de {marca}.")
        )

        disenos = construir_disenos(colores, imagenes_galeria)

        resultados.append(
            {
                "nombre": nombre_completo,
                "marca": marca,
                "descripcion": descripcion,
                "categoria": "Celulares",
                "precio": precio_mxn,
                "precio_referencia": precio_raw,
                "url": url_detalle,
                "disenos": disenos,
            }
        )
        print(f"  + {nombre_completo} (${precio_mxn:,.2f} MXN | {len(imagenes_galeria)} fotos)")

    return resultados


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Scraper de celulares desde GSMArena que genera productos.json"
    )
    parser.add_argument(
        "-o",
        "--output",
        default="productos.json",
        help="Ruta del archivo JSON de salida (por defecto: productos.json)",
    )
    parser.add_argument(
        "-t",
        "--total",
        type=int,
        default=50,
        help="Cantidad total de celulares a extraer (por defecto: 50)",
    )
    args = parser.parse_args()

    productos: list[dict[str, Any]] = []
    urls_vistas: set[str] = set()
    total = max(1, args.total)

    with requests.Session() as session:
        restantes_marcas = len(MARCAS)
        for marca, url_marca in MARCAS:
            faltan = total - len(productos)
            if faltan <= 0:
                break
            cuota = (faltan + restantes_marcas - 1) // restantes_marcas
            items = scrape_marca(session, marca, url_marca, cuota, urls_vistas)
            productos.extend(items)
            restantes_marcas -= 1

        if len(productos) < total:
            for marca, url_marca in MARCAS:
                faltan = total - len(productos)
                if faltan <= 0:
                    break
                items = scrape_marca(session, marca, url_marca, faltan, urls_vistas)
                productos.extend(items)

    productos = productos[:total]

    for idx, producto in enumerate(productos, start=1):
        productos[idx - 1] = {
            "id": idx,
            "nombre": producto["nombre"],
            "marca": producto["marca"],
            "descripcion": producto["descripcion"],
            "categoria": producto["categoria"],
            "precio": producto["precio"],
            "precio_referencia": producto["precio_referencia"],
            "url": producto["url"],
            "disenos": producto["disenos"],
        }

    with open(args.output, "w", encoding="utf-8") as archivo:
        json.dump(productos, archivo, ensure_ascii=False, indent=2)

    print(f"\nListo: se guardaron {len(productos)} celulares en '{args.output}'.")


if __name__ == "__main__":
    main()