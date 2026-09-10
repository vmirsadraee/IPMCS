from datetime import datetime, date
from persiantools.jdatetime import JalaliDate


def gregorian_to_jalali(value: date | datetime):
    """
    Convert Gregorian date/datetime to Jalali date.
    """

    if isinstance(value, datetime):
        return JalaliDate(value.date())

    return JalaliDate(value)


def jalali_to_gregorian(
    year: int,
    month: int,
    day: int
) -> date:
    """
    Convert Jalali date to Gregorian date.
    """

    jalali_date = JalaliDate(year, month, day)

    return jalali_date.to_gregorian()


def format_gregorian(value: date | datetime) -> str:
    """
    Format Gregorian date for display.
    """

    if isinstance(value, datetime):
        value = value.date()

    return value.strftime("%Y-%m-%d")


def format_jalali(value: date | datetime) -> str:
    """
    Format Jalali date for display.
    """

    jalali_date = gregorian_to_jalali(value)

    return (
        f"{jalali_date.year:04d}-"
        f"{jalali_date.month:02d}-"
        f"{jalali_date.day:02d}"
    )