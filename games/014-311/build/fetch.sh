set -euo pipefail
cd "$(dirname "$0")/raw"
B='https://data.cityofnewyork.us/resource/erm2-nwe9.json'
W="created_date between '2025-01-01T00:00:00' and '2025-12-31T23:59:59' and incident_zip is not null"
curl -sG "$B" -A "daily-data-games class project" --data-urlencode "\$select=incident_zip,complaint_type,count(*) as n" --data-urlencode "\$where=$W" --data-urlencode "\$group=incident_zip,complaint_type" --data-urlencode "\$limit=50000" -o counts.json
curl -sG "$B" -A "daily-data-games class project" --data-urlencode "\$select=incident_zip,avg(latitude) as lat,avg(longitude) as lng,max(borough) as borough,count(*) as n" --data-urlencode "\$where=$W and latitude is not null" --data-urlencode "\$group=incident_zip" --data-urlencode "\$limit=50000" -o zips.json
# ZIP (MODZCTA) boundaries, used for the polygon centroid and the reveal outline
[ -s zipshapes.geojson ] || { sleep 2; curl -sG 'https://data.cityofnewyork.us/resource/pri4-ifjk.geojson' -A "daily-data-games class project" --data-urlencode '$limit=500' -o zipshapes.geojson; }
