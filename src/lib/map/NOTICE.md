# Map data

`armenia-basemap.json` (country and province borders, lakes, rivers and main roads around Armenia) is derived from
[Natural Earth](https://www.naturalearthdata.com/) 1:10m vector data, which is in the public domain.

It was clipped to the region around Armenia and simplified with [mapshaper](https://mapshaper.org/):

```bash
mapshaper ne_10m_admin_1_states_provinces.geojson -filter 'adm0_a3=="ARM"' -simplify 70% keep-shapes ...
```

Borders are shown for orientation only. Place names in `places.ts` are maintained by hand (hy / en / ru).
