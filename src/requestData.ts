import { filterWayData, filterNodeData, filterRelData } from './filtersOverpass'
import OverpassFrontend from 'overpass-frontend/src/OverpassFrontend'
import OverpassDefines from 'overpass-frontend/src/defines'

const overpass = new OverpassFrontend('//overpass-api.de/api/interpreter/', {})

export default (query, bbox) => new Promise((resolve, reject) => {
  const list = []

  const parseObject = (err, ob, idx) => {
    if (err) {
      console.log('OBJECT ERROR: ', err)
      return
    }
    switch (ob.type) {
      case 'way': list.push(filterWayData(ob)); break
      case 'node': list.push(filterNodeData(ob)); break
      case 'ler': list.push(filterRelData(ob)); break
    }
    // console.log(ob)
    // console.log(`got object ${idx}`)
  }

  const callback = (err) => {
    if (err) {
      reject(`QUERY ERROR: ${err}`)
      return
    }
    resolve(list)
  }

  if (bbox) {
    const properties = OverpassDefines.CENTER | OverpassDefines.GEOM | OverpassDefines.TAGS
    overpass.BBoxQuery(query, bbox, {
      properties,
      split: 500,
    }, parseObject, callback)
  } else {
    // overpass.get()
    callback('TODO')
  }

})