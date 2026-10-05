from enum import StrEnum


class City(StrEnum):
    """Города, где работает платформа. Названия переводит фронт по ключу."""

    PAVLODAR = "pavlodar"
    ASTANA = "astana"
    ALMATY = "almaty"
