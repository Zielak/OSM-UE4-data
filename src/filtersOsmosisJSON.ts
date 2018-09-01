import geometryToBoundary from './buildBoundries'
import { JsonXmlObject, UEObject, JsonXmlChild, Geometry, GeometryItem } from './types'

const reqWayFields = ['id', 'osm_id', 'type', 'bounds', 'center', 'geometry', 'nodes']
const reqWayTags = new Set([
  // TODO: filter out junk data
  'amenity',
  'building', 'building:levels',
])

const simplifyXmlTag = (obj: JsonXmlChild) => {
  const key = obj.attrs.k
  const value = obj.attrs.v
  const result = {}
  result[key] = value
  return result
}

export const filterNodeData = (obj: JsonXmlObject): UEObject => {
  let out: UEObject = {
    Name: obj.tag[0] + obj.attrs.id,
    type: obj.tag,
    lat: parseFloat(obj.attrs.lat),
    lon: parseFloat(obj.attrs.lon)
  }

  return out
}

export const filterWayData = (obj: JsonXmlObject): UEObject => {
  let out: UEObject = {
    Name: obj.tag[0] + obj.attrs.id,
    type: obj.tag,
    // center_x: obj.center.lat,
    // center_y: obj.center.lon,
  }

  if (obj.children) {
    if (obj.children.some(el => el.tag === 'tag')) {
      out.tags = {}
      const tags = obj.children
        .filter(el => el.tag === 'tag')
        .map(el => simplifyXmlTag(el))
        .reduce((prev, keyVal) => {
          return {
            ...prev,
            ...keyVal
          }
        }, {})

      for (const key of Object.getOwnPropertyNames(tags)) {
        if (reqWayTags.has(key)) {
          out.tags[key] = tags[key]
        }
      }
    }
    // if (obj.children.some(el => el.tag === 'nd')) {
    //   const geometry: Geometry = obj.children
    //     .filter(el => el.tag === 'nd')
    //     .map(el => nodesMemory.get(el.attrs.ref))

    //   out.boundary = geometryToBoundary(geometry)
    // }
  }
  return out
}