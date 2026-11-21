#!/usr/bin/env python3
"""
Fetch curated Spine 3.7 pet animations, clean scene backgrounds, element icons,
and background music from Aola Star H5 CDN into apps/client/public/assets/.
"""
import json
import os
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(ROOT, "apps", "client", "public", "assets")
VMAP_CACHE = os.path.join(TOOLS_DIR, "vmap_cache.json")

PET_IDS = ["5880", "5943", "6101", "6106", "6118", "5879", "6074", "6115"]
SCENE_FILES = [
    ("bg/lobby_galaxy.jpg", "scene/galaxyfleetsquare/img_bg.jpg"),
    ("bg/lobby_square.jpg", "scene/mainsquare/img_bg.jpg"),
    ("bg/battle_arena1.jpg", "activityres/activity200930/petfightspace/img_bg0.jpg"),
    ("bg/arena_night.png", "activityres/activity220729/langmanxinhbiwu/main/bg2.png"),
    ("bg/arena_dojo.png", "activityres/activity211126/yongchuntiguanbattle/main/img_bg.png"),
]
EXTRA_FILES = [
    ("ui/petfight_main.png", "petfightnew/main.png"),
    ("ui/petfight_main.atlas", "petfightnew/main.atlas"),
    ("audio/bgm.mp3", "sounds/background.mp3"),
] + [(f"ui/attr_{i}.png", f"petattribute/attribute{i}.png") for i in range(1, 16)]


def curl_bytes(url: str) -> bytes:
    last_err = None
    for candidate in (url, url.replace("https://", "http://", 1)):
        for attempt in range(3):
            try:
                return subprocess.check_output(
                    [
                        "curl.exe",
                        "-4",
                        "-sL",
                        "--fail",
                        "--retry",
                        "3",
                        "--retry-delay",
                        "1",
                        "--connect-timeout",
                        "10",
                        "-m",
                        "35",
                        "-A",
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                        "-e",
                        "https://aola.100bt.com/h5/",
                        candidate,
                    ]
                )
            except Exception as exc:
                last_err = exc
                time.sleep(0.8 * (attempt + 1))
    raise last_err  # type: ignore[misc]


def load_vmap() -> dict:
    if os.path.exists(VMAP_CACHE):
        with open(VMAP_CACHE, "r", encoding="utf-8") as f:
            return json.load(f)
    start = json.loads(curl_bytes("https://aola.100bt.com/h5/start~1.json").decode("utf-8"))
    ver = start["version"]
    raw = curl_bytes(f"https://aola.100bt.com/h5/version~{ver}.json")
    with open(VMAP_CACHE, "wb") as f:
        f.write(raw)
    return json.loads(raw.decode("utf-8"))


def versioned_url(vmap: dict, rel_path: str) -> str:
    h = vmap.get(rel_path)
    if not h:
        return f"https://aola.100bt.com/h5/{rel_path}"
    dot = rel_path.rfind(".")
    return f"https://aola.100bt.com/h5/{rel_path[:dot]}~{h}{rel_path[dot:]}"


def download_to(vmap: dict, rel_path: str, out_path: str) -> bool:
    if os.path.exists(out_path) and os.path.getsize(out_path) > 0:
        return True
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    url = versioned_url(vmap, rel_path)
    try:
        data = curl_bytes(url)
        if not data:
            return False
        with open(out_path, "wb") as f:
            f.write(data)
        print(f"Downloaded {rel_path} -> {os.path.relpath(out_path, ROOT)} ({len(data)} bytes)")
        return True
    except Exception as exc:
        print(f"WARN: failed {rel_path}: {exc}", file=sys.stderr)
        return False


def main():
    vmap = load_vmap()
    for pid in PET_IDS:
        base_rel = f"petfightassets/spine/pet{pid}"
        base_out = os.path.join(ASSETS_DIR, "pets", f"pet{pid}")
        for ext in ("json", "atlas", "png"):
            download_to(vmap, f"{base_rel}/pet{pid}.{ext}", os.path.join(base_out, f"pet{pid}.{ext}"))

    for out_rel, rel_path in SCENE_FILES + EXTRA_FILES:
        if rel_path in vmap:
            download_to(vmap, rel_path, os.path.join(ASSETS_DIR, out_rel))


if __name__ == "__main__":
    main()
