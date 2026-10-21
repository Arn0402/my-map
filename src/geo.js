// A flat local projection around the kit centre: x metres east, y metres north.
// Over a 2 km area the error against true distances is far below a metre.
const R = 6371008.8
const RAD = Math.PI / 180

export function makeProjection([lon0, lat0]) {
  const kx = R * RAD * Math.cos(lat0 * RAD)
  const ky = R * RAD
  return {
    toXY: ([lon, lat]) => [(lon - lon0) * kx, (lat - lat0) * ky],
    toLonLat: ([x, y]) => [lon0 + x / kx, lat0 + y / ky],
  }
}
