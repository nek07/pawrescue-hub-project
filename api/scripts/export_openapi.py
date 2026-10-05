"""Выгружает openapi.json без запуска сервера: uv run python scripts/export_openapi.py [путь]."""

import json
import sys
from pathlib import Path

from app.main import create_app


def main() -> None:
    target = Path(sys.argv[1] if len(sys.argv) > 1 else "openapi.json")
    schema = create_app().openapi()
    target.write_text(json.dumps(schema, ensure_ascii=False, indent=2, sort_keys=True) + "\n")
    print(f"OpenAPI → {target}")


if __name__ == "__main__":
    main()
