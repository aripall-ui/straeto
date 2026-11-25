"""Build the board's timetable from Strætó GTFS. Pass a local ZIP to reuse a download."""
import csv
from datetime import date, timedelta
import io
import json
from pathlib import Path
import sys
from urllib.request import urlopen
from zipfile import ZipFile


SOURCE = 'https://opendata.straeto.is/data/gtfs/gtfs.zip'
STOPS = {
    '13': ('90000179', '90000083'),
    '1': ('90000296', '90000015'),
    '3': ('90000296', '90000461'),
    '6': ('90000882', '90000461'),
}
WEEKDAYS = ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')


def records(archive, name):
    with archive.open(name + '.txt') as stream:
        yield from csv.DictReader(io.TextIOWrapper(stream, encoding='utf-8-sig'))


def service_dates(archive):
    dates = {}
    epoch = date(1970, 1, 1)
    for row in records(archive, 'calendar'):
        start = date.fromisoformat(format_date(row['start_date']))
        end = date.fromisoformat(format_date(row['end_date']))
        active = dates.setdefault(row['service_id'], set())
        current = start
        while current <= end:
            if row[WEEKDAYS[current.weekday()]] == '1':
                active.add((current - epoch).days)
            current += timedelta(days=1)
    for row in records(archive, 'calendar_dates'):
        service = dates.setdefault(row['service_id'], set())
        day = (date.fromisoformat(format_date(row['date'])) - epoch).days
        if row['exception_type'] == '1':
            service.add(day)
        else:
            service.discard(day)
    return dates


def format_date(value):
    return value[:4] + '-' + value[4:6] + '-' + value[6:]


def seconds(value):
    hours, minutes, secs = map(int, value.split(':'))
    return hours * 3600 + minutes * 60 + secs


def build(archive):
    route_numbers = {row['route_id']: row['route_short_name'] for row in records(archive, 'routes')}
    trips = {}
    for row in records(archive, 'trips'):
        number = route_numbers.get(row['route_id'])
        if number in STOPS:
            trips[row['trip_id']] = (number, row['service_id'])

    by_route = {number: {} for number in STOPS}
    dates = service_dates(archive)
    stops_by_trip = {}
    for row in records(archive, 'stop_times'):
        trip_id = row['trip_id']
        if trip_id not in trips:
            continue
        number, service = trips[trip_id]
        board, exit = STOPS[number]
        seq = int(row['stop_sequence'])
        if row['stop_id'] == board and row['pickup_type'] != '1' and row['departure_time']:
            stops_by_trip.setdefault(trip_id, [[], []])[0].append((seq, seconds(row['departure_time'])))
        if row['stop_id'] == exit and row['drop_off_type'] != '1' and row['arrival_time']:
            stops_by_trip.setdefault(trip_id, [[], []])[1].append((seq, seconds(row['arrival_time'])))

    services = {}
    for trip_id, (boarding, arrivals) in stops_by_trip.items():
        number, service = trips[trip_id]
        if not boarding or not dates.get(service):
            continue
        arrivals.sort()
        by_route[number][trip_id] = [
            [departure, service, next((time for stop_seq, time in arrivals
                                       if stop_seq > seq and time >= departure), None)]
            for seq, departure in sorted(boarding)
        ]
        services[service] = sorted(dates[service])
    if not all(by_route.values()):
        raise ValueError('The GTFS file is missing trips for at least one boarding stop')
    return {'routes': by_route, 'services': services}


def main():
    if len(sys.argv) > 1:
        source = sys.argv[1]
    else:
        with urlopen(SOURCE, timeout=30) as response:
            source = io.BytesIO(response.read())
    with ZipFile(source) as archive:
        timetable = build(archive)
    target = Path(__file__).resolve().parents[1] / 'dist' / 'timetable.json'
    target.write_text(json.dumps(timetable, separators=(',', ':'), sort_keys=True) + '\n')


if __name__ == '__main__':
    main()
