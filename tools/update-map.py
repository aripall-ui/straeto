"""Build dist/kort.json, the data for the approach map, from Strætó GTFS.

For each boarding stop the apps use, it stores the route line for the last
stretch before the stop, the stops along it and faint lines of all bus routes
nearby as a street backdrop. Pass a local ZIP to reuse a download.
"""
import csv
from collections import Counter, defaultdict
import io
import json
import math
from pathlib import Path
import sys
from urllib.request import urlopen
from zipfile import ZipFile


SOURCE = 'https://opendata.straeto.is/data/gtfs/gtfs.zip'
OUTPUT = Path(__file__).resolve().parent.parent / 'dist' / 'kort.json'
BEFORE = 2500   # metrar af leið á undan stoppi
AFTER = 250     # metrar á eftir stoppi
MARGIN = 200    # metrar umhverfis leiðina sem bakgrunnur nær yfir
TOLERANCE = 6   # metrar við einföldun lína
ASPECT = 0.68   # hæð/breidd kortsins

# leið, brottfararstopp, áfangastaðir (headsign) eins og í dist/app.js og dist/heim/heim.js
SEGMENTS = [
    ('13', '90000179', ['Sléttuvegur']),
    ('1', '90000296', ['Hfj. Skarðshlíð']),
    ('3', '90000296', ['Sel/Fell']),
    ('6', '90000882', ['Egilshöll']),
    ('13', '90000084', ['Eiðisgrandi', 'Öldugrandi']),
    ('11', '90000084', ['Seltjarnarnes', 'Eiðistorg']),
    ('3', '90000013', ['Grandi']),
    ('6', '90000013', ['HÍ', 'Háskóli Íslands']),
    ('1', '90000016', ['Skúlagata']),
    ('18', '90000324', ['Skúlagata']),
]


def records(archive, name):
    with archive.open(name + '.txt') as stream:
        yield from csv.DictReader(io.TextIOWrapper(stream, encoding='utf-8-sig'))


def metres(a, b):
    lat = math.radians((a[0] + b[0]) / 2)
    return math.hypot((b[0] - a[0]) * 111320, (b[1] - a[1]) * 111320 * math.cos(lat))


def simplify(points, tolerance=TOLERANCE):
    if len(points) < 3:
        return points
    lat = math.radians(points[0][0])
    xy = [(p[1] * 111320 * math.cos(lat), p[0] * 111320) for p in points]
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        start, end = stack.pop()
        (x1, y1), (x2, y2) = xy[start], xy[end]
        length = math.hypot(x2 - x1, y2 - y1) or 1e-9
        best, index = 0, None
        for i in range(start + 1, end):
            x, y = xy[i]
            distance = abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1) / length
            if distance > best:
                best, index = distance, i
        if index is not None and best > tolerance:
            keep[index] = True
            stack += [(start, index), (index, end)]
    return [p for p, k in zip(points, keep) if k]


def rounded(point):
    return [round(point[0], 5), round(point[1], 5)]


def main():
    data = Path(sys.argv[1]).read_bytes() if len(sys.argv) > 1 else urlopen(SOURCE, timeout=120).read()
    archive = ZipFile(io.BytesIO(data))

    routes = defaultdict(set)
    for row in records(archive, 'routes'):
        routes[row['route_short_name']].add(row['route_id'])
    stops = {row['stop_id']: (row['stop_name'], float(row['stop_lat']), float(row['stop_lon']))
             for row in records(archive, 'stops')}

    wanted = {}  # trip_id -> list of segment indexes
    trip_shape = {}
    for row in records(archive, 'trips'):
        for index, (number, _, signs) in enumerate(SEGMENTS):
            if row['route_id'] in routes[number] and row['trip_headsign'].strip() in signs:
                wanted.setdefault(row['trip_id'], []).append(index)
                trip_shape[row['trip_id']] = row['shape_id']

    sequences = defaultdict(list)
    for row in records(archive, 'stop_times'):
        if row['trip_id'] in wanted:
            sequences[row['trip_id']].append((int(row['stop_sequence']), row['stop_id']))

    chosen = []
    for index, (number, board, _) in enumerate(SEGMENTS):
        serving = [trip for trip, indexes in wanted.items()
                   if index in indexes and any(stop == board for _, stop in sequences[trip])]
        if not serving:
            raise SystemExit(f'Engin ferð fannst fyrir leið {number} frá {board}')
        shape = Counter(trip_shape[trip] for trip in serving).most_common(1)[0][0]
        trip = next(trip for trip in serving if trip_shape[trip] == shape)
        chosen.append((shape, [stop for _, stop in sorted(sequences[trip])]))

    shapes = defaultdict(list)
    for row in records(archive, 'shapes'):
        shapes[row['shape_id']].append((int(row['shape_pt_sequence']), float(row['shape_pt_lat']), float(row['shape_pt_lon'])))
    shapes = {key: [(lat, lon) for _, lat, lon in sorted(points)] for key, points in shapes.items()}

    output = {}
    for (number, board, _), (shape, sequence) in zip(SEGMENTS, chosen):
        points = shapes[shape]
        stop = stops[board]
        centre = min(range(len(points)), key=lambda i: metres(points[i], stop[1:]))
        start, travelled = centre, 0
        while start > 0 and travelled < BEFORE:
            travelled += metres(points[start - 1], points[start])
            start -= 1
        end, travelled = centre, 0
        while end < len(points) - 1 and travelled < AFTER:
            travelled += metres(points[end], points[end + 1])
            end += 1
        # Stoppið sjálft er punktur á línunni svo appið geti mælt fjarlægð að því.
        approach = simplify(points[start:centre + 1] + [stop[1:]], 3)
        line = approach + simplify([stop[1:]] + points[centre + 1:end + 1], 3)[1:]

        position = sequence.index(board)
        along = []
        for stop_id in reversed(sequence[:position]):
            name, lat, lon = stops[stop_id]
            if min(metres(p, (lat, lon)) for p in line) > 40:
                break
            along.append({'name': name, 'at': rounded((lat, lon))})
        along.reverse()

        margin_lat = MARGIN / 111320
        margin_lon = MARGIN / (111320 * math.cos(math.radians(stop[1])))
        box = [min(p[0] for p in line) - margin_lat, min(p[1] for p in line) - margin_lon,
               max(p[0] for p in line) + margin_lat, max(p[1] for p in line) + margin_lon]
        # Stækka minni víddina svo kortið hafi alltaf hlutfallið ASPECT (hæð/breidd).
        width = (box[3] - box[1]) * math.cos(math.radians(stop[1]))
        height = box[2] - box[0]
        if height / width < ASPECT:
            grow = (width * ASPECT - height) / 2
            box[0] -= grow
            box[2] += grow
        else:
            grow = (height / ASPECT - width) / 2 / math.cos(math.radians(stop[1]))
            box[1] -= grow
            box[3] += grow
        inside = lambda p: box[0] <= p[0] <= box[2] and box[1] <= p[1] <= box[3]
        edges = set()
        for other in shapes.values():
            run = []
            for i, point in enumerate(other):
                near = inside(point) or (i + 1 < len(other) and inside(other[i + 1])) or (i and inside(other[i - 1]))
                if near:
                    run.append(point)
                if run and (not near or i == len(other) - 1):
                    simple = [tuple(rounded(p)) for p in simplify(run)]
                    edges.update(tuple(sorted(pair)) for pair in zip(simple, simple[1:]) if pair[0] != pair[1])
                    run = []
        output[number + '|' + board] = {
            'stop': {'name': stop[0], 'at': rounded(stop[1:])},
            'line': [rounded(p) for p in line],
            'stops': along,
            'box': [round(value, 5) for value in box],
            'streets': [list(map(list, edge)) for edge in sorted(edges)],
        }

    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'Skrifaði {OUTPUT} ({OUTPUT.stat().st_size // 1024} KB, {len(output)} leiðarhlutar)')


if __name__ == '__main__':
    main()
