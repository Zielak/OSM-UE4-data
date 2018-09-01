import { distance, getAngle } from './utils'
import { Geometry, GeometryItem, Boundary } from './types'

const geometryToBoundries = (geometry: Geometry) =>
  geometry.map(createBoundry).filter(edge => Boolean(edge))

const createBoundry = (item: GeometryItem, idx, array: Geometry) => {
  // Omit for last node, it's repeated.
  if (idx === array.length - 1) {
    return
  }
  const nextNode = array[idx + 1]

  const x1 = item.lat
  const y1 = item.lon
  const x2 = nextNode.lat
  const y2 = nextNode.lon

  const edge: Boundary = {
    x: x1, y: y1,
    length: distance(x1, y1, x2, y2),
    angleZ: getAngle(x1, y1, x2, y2)
  }

  return edge
}

export default geometryToBoundries
