"""Offline release checks for links, private residue, EDR hygiene, and required artifacts."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import struct
import sys
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
SKIP = {".git", ".venv", "dist", "build", "__pycache__", ".integration", "node_modules", ".codex-tmp", ".legends-obs-kit", ".github-audit"}
REQUIRED = [
    "README.md",
    "LICENSE",
    "NOTICE",
    "THIRD_PARTY_NOTICES.md",
    "AGENTS.md",
    "SECURITY.md",
    "SUPPORT.md",
    "CONTRIBUTING.md",
    "CODE_OF_CONDUCT.md",
    "CHANGELOG.md",
    "CITATION.cff",
    "docs/AGENT-RECIPE.md",
    "skills/cto-legends/SKILL.md",
    ".legends-module",
    ".legends-router-pin",
    "assets/banner.png",
    "assets/banner.webp",
    "assets/preview.png",
    "assets/social-preview.png",
    "assets/manifest.json",
]
TEXT_SUFFIXES = {".md", ".py", ".json", ".toml", ".yml", ".yaml", ".in", ".txt", ".cfg", ".ini", ".cff", ".ts", ".js", ".mjs", ".lua"}
FORBIDDEN = [
    r"(?i)[a-z]:\\{1,2}users\\{1,2}(?!\\|public\b|default\b|someone\b|you\b|<)",
    r"(?i)\.tail[a-z0-9]+\.ts\.net",
    r"(?i)nsec1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{30,}",
    r"(?i)sk_live_[a-z0-9]{12,}",
    r"(?i)rk_live_[a-z0-9]{12,}",
    r"gh[pousr]_[A-Za-z0-9]{20,}",
    r"-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----",
    r"CREATE_NO_WINDOW",
    r"0x08000000",
    r"(?i)-WindowStyle\s+Hidden",
    r"(?i)-ExecutionPolicy\s+Bypass",
    r"(?i)EncodedCommand",
    r"ctypes\.windll",
    r"(?i)CryptUnprotectData",
    r"(?i)GetAsyncKeyState",
    r"(?i)IndexedDB",
    r"shell\s*=\s*True",
]
FORBIDDEN_FILES = {".pem", ".key", ".p12", ".pfx", ".ps1", ".bat", ".cmd", ".vbs", ".ahk"}
PNG_METADATA_CHUNKS = {"tEXt", "iTXt", "zTXt", "eXIf"}
WEBP_METADATA_CHUNKS = {b"EXIF", b"XMP "}
CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\ufffd]")
REQUIRED_SKILL_PATTERNS = [
    r"^---\s*\nname:\s*cto-legends\s*\n",
    r"cto-legends handoff <module>",
    r"## Install law: suggest, never seize",
    r"Do not use em dashes",
]


def _cursor_lua_opt_in_verified(text: str) -> bool:
    return bool(
        re.search(r"\benable_left_click\s*=\s*false\b", text)
        and re.search(r"\benable_right_click\s*=\s*false\b", text)
    )


def image_metadata_issues(path: Path) -> list[str]:
    """Flag raster metadata chunks that can carry authoring residue."""
    try:
        raw = path.read_bytes()
    except OSError:
        return [f"Cannot read image: {path}"]
    issues: list[str] = []
    suffix = path.suffix.lower()
    if suffix == ".png":
        if raw[:8] != b"\x89PNG\r\n\x1a\n":
            return [f"Not a PNG file: {path}"]
        offset = 8
        while offset + 8 <= len(raw):
            length = struct.unpack(">I", raw[offset : offset + 4])[0]
            chunk = raw[offset + 4 : offset + 8]
            try:
                name = chunk.decode("latin1")
            except UnicodeError:
                break
            if name in PNG_METADATA_CHUNKS:
                issues.append(f"Image metadata chunk {name} in {path.name}; strip authoring residue.")
            if name == "IEND":
                break
            offset += 12 + length
    elif suffix == ".webp":
        if raw[:4] != b"RIFF" or raw[8:12] != b"WEBP":
            return [f"Not a WebP file: {path}"]
        offset = 12
        while offset + 8 <= len(raw):
            tag = raw[offset : offset + 4]
            length = struct.unpack("<I", raw[offset + 4 : offset + 8])[0]
            if tag in WEBP_METADATA_CHUNKS:
                issues.append(f"Image metadata chunk {tag!r} in {path.name}; strip authoring residue.")
                break
            offset += 8 + length + (length % 2)
    return issues


def check(root: Path = ROOT) -> list[str]:
    errors: list[str] = []
    for name in REQUIRED:
        if not (root / name).is_file():
            errors.append(f"Missing required file: {name}")

    if (root / ".legends-module").is_file():
        mod = (root / ".legends-module").read_text(encoding="utf-8-sig").strip()
        if mod != "legends-obs":
            errors.append(f".legends-module mismatch: {mod!r}")

    if all((root / f).is_file() for f in ("package.json", "src/identity.ts", "CITATION.cff", "CHANGELOG.md")):
        pkg = json.loads((root / "package.json").read_text(encoding="utf-8-sig"))
        identity_ts = (root / "src/identity.ts").read_text(encoding="utf-8-sig")
        citation = (root / "CITATION.cff").read_text(encoding="utf-8-sig")
        changelog = (root / "CHANGELOG.md").read_text(encoding="utf-8-sig")
        m_id = re.search(r'\bVERSION\s*=\s*"([^"]+)"', identity_ts)
        m_cit = re.search(r'^version:\s*"?([^"\r\n]+)"?', citation, re.M)
        m_chg = re.search(r"^##\s+\[?v?(\d+\.\d+\.\d+)\]?", changelog, re.M)
        versions = {
            "package.json": pkg.get("version"),
            "src/identity.ts": m_id.group(1) if m_id else None,
            "CITATION.cff": m_cit.group(1).strip() if m_cit else None,
            "CHANGELOG.md": m_chg.group(1) if m_chg else None,
        }
        if len(set(versions.values())) != 1 or None in versions.values():
            errors.append(f"Version mismatch across files: {versions}")

    manifest = root / "assets" / "manifest.json"
    if manifest.is_file():
        try:
            entries = json.loads(manifest.read_text(encoding="utf-8-sig"))["files"]
        except (ValueError, KeyError):
            errors.append("assets/manifest.json is not a manifest with files.")
            entries = []
        for entry in entries:
            target = root / "assets" / entry.get("name", "")
            try:
                raw = target.read_bytes()
            except OSError:
                errors.append(f"Manifest asset missing: {entry.get('name')}")
                continue
            if len(raw) != entry.get("bytes"):
                errors.append(f"Manifest byte mismatch: {entry.get('name')}")
            if hashlib.sha256(raw).hexdigest() != entry.get("sha256"):
                errors.append(f"Manifest hash mismatch: {entry.get('name')}")

    skill_files: list[str] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP and not d.endswith(".egg-info")]
        for filename in filenames:
            path = Path(dirpath) / filename
            rel = path.relative_to(root)
            rel_posix = rel.as_posix()
            if filename == "SKILL.md":
                skill_files.append(rel_posix)
            if path.suffix.lower() in FORBIDDEN_FILES:
                errors.append(f"Forbidden file extension must not ship: {rel}")
                continue
            if path.suffix.lower() in {".png", ".webp"}:
                errors.extend(f"{rel}: {issue}" for issue in image_metadata_issues(path))
                continue
            if path.suffix not in TEXT_SUFFIXES and path.name not in {"LICENSE", "NOTICE", ".legends-module", ".legends-router-pin"}:
                continue
            text = path.read_text(encoding="utf-8-sig")
            if CONTROL_CHAR_RE.search(text):
                errors.append(f"Control character or replacement diamond in text file: {rel}")
            if path.name not in {"check_release.py", "check-package-contents.mjs"}:
                for pattern in FORBIDDEN:
                    if (
                        pattern == r"(?i)GetAsyncKeyState"
                        and rel_posix == "extras/cursor/legends_cursor_filter.lua"
                        and _cursor_lua_opt_in_verified(text)
                    ):
                        continue
                    if re.search(pattern, text):
                        errors.append(f"Possible private or EDR-sensitive residue ({pattern}): {rel}")
            if path.suffix != ".md":
                continue
            if "\u2014" in text or "\u2013" in text:
                errors.append(f"Disallowed dash in copy: {rel}")
            for target_link in re.findall(r"\[[^\]]*\]\(([^)]+)\)", text):
                if target_link.startswith(("https://", "http://", "mailto:", "#")):
                    continue
                cleaned = unquote(target_link.split("#", 1)[0].split("?", 1)[0])
                resolved = (path.parent / cleaned).resolve()
                if not resolved.is_relative_to(root.resolve()) or not resolved.exists():
                    errors.append(f"Broken or external local link: {rel}: {target_link}")

    if skill_files != ["skills/cto-legends/SKILL.md"]:
        errors.append(f"One-Skill Rule violation: found SKILL.md at {skill_files}")
    else:
        skill_text = (root / "skills/cto-legends/SKILL.md").read_text(encoding="utf-8-sig")
        for pat in REQUIRED_SKILL_PATTERNS:
            if not re.search(pat, skill_text, re.M):
                errors.append(f"skills/cto-legends/SKILL.md missing required router content: {pat}")

    return errors


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Offline release checks.")
    parser.add_argument("--root", type=Path, default=ROOT)
    options = parser.parse_args()
    failures = check(options.root)
    for failure in failures:
        print(failure)
    print(f"Release checks: {'FAIL' if failures else 'PASS'} ({len(failures)} issues)")
    sys.exit(bool(failures))
