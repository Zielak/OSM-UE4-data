
// Numbers

export const wrap = (val, min, max) => val - (max - min) * Math.floor(val / (max - min))
export const limit = (val, min, max) => Math.max(Math.min(max, val), min)

// Strings

export const excerpt = (val: string, maxChars = 200, ellipsis = ' … ') => {
  const partLength = maxChars / 2 - (ellipsis.length + 0.5) / 2
  // FIXME: works badly with strings shorter, around `maxChars`
  return val.substr(0, partLength) + ellipsis + val.substr(-partLength)
}

// Geographic

// const times = 10000000
// export const latToX = lat => (lat - 50.298) * times
// export const lonToY = lon => (lon - 19.135) * times

export const distance = (x1, y1, x2, y2) =>
  Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))

export const rad2deg = angle => angle * (180 / Math.PI)
export const deg2rad = angle => angle * (Math.PI / 180)
export const getAngle = (x1, y1, x2, y2) => {
  const angle = rad2deg(Math.atan2(y2 - y1, x2 - x1)) - 90
  return wrap(angle, 0, 360)
}