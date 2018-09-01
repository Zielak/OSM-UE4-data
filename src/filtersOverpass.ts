import geometryToBoundary from './buildBoundries'
import { OSMObject, UEObject } from './types'

const reqWayFields = ['id', 'osm_id', 'type', 'bounds', 'center', 'geometry', 'nodes']
const reqWayTags = new Set([
  // TODO: filter out junk data
  'amenity',
  'building', 'building:levels',
])

// TODO: probably translate Real-life coords to UE4 units

export const filterWayData = (obj: OSMObject): UEObject => {
  let out: UEObject = {
    Name: obj.id,
    type: obj.type,
    center_x: obj.center.lat,
    center_y: obj.center.lon,
    boundary: geometryToBoundary(obj.geometry)
  }

  if (obj.tags) {
    out.tags = {}
    for (const key of Object.getOwnPropertyNames(obj.tags)) {
      if (reqWayTags.has(key)) {
        out.tags[key] = obj.tags[key]
      }
    }
  }
  return out
}
export const filterNodeData = (node) => { }
export const filterRelData = (rel) => { }

