
export type WorkerState = {
  prepared: boolean,
  finished: boolean,
  preparedByteStart?: number,
  preparedByteEnd?: number,
}

export type GeometryItem = {
  lat: number,
  lon: number
}
export type Geometry = Array<GeometryItem>

export type Boundary = {
  x: number,
  y: number,
  // z: number, // TODO: heightmaps?
  length: number,
  height?: number,
  thickness?: number,
  angleZ: number,
}

export enum OSMObjectType {
  node = 'node',
  way = 'way',
  rel = 'rel'
}

export type OSMObject = {
  id?: string,
  osm_id?: number,
  type: OSMObjectType,
  geometry: Geometry,
  center?: {
    lat: number,
    lon: number
  }
  tags?: {
    [key: string]: string
  }
}

export type JsonXmlObject = {
  tag: OSMObjectType,
  attrs: {
    minlon?: string,
    minlat?: string,
    maxlon?: string,
    maxlat?: string,
    origin?: string,

    version?: string,
    timestamp?: string,
    uid?: string,
    user?: string,
    lat?: string,
    lon?: string,

    id?: string,
  },
  text?: string,
  children: Array<JsonXmlChild>
}

export type JsonXmlChild = {
  tag?: string,
  attrs: {
    k?: string,
    v?: string,
    ref?: string
  }
}

export type UEObject = {
  Name?: string,
  type: OSMObjectType,
  lat?: number,
  lon?: number,
  center_x?: number,
  center_y?: number,
  boundary?: Array<Boundary>
  tags?: {
    [key: string]: string
  }
}