/**
 * Haversine公式计算两点距离（米）
 */
const EARTH_RADIUS = 6371000

export function haversineDistance(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const radLat1 = (lat1 * Math.PI) / 180
  const radLat2 = (lat2 * Math.PI) / 180
  const radLon1 = (lon1 * Math.PI) / 180
  const radLon2 = (lon2 * Math.PI) / 180

  const dLat = radLat2 - radLat1
  const dLon = radLon2 - radLon1

  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLon / 2) ** 2

  const c = 2 * Math.asin(Math.sqrt(a))
  return EARTH_RADIUS * c
}

import type { StationInfo, BusInfo } from '@/types/bus'

/**
 * 估算公交到站时间（分钟）
 */
export function estimateArrivalTime(
  bus: BusInfo,
  stationList: StationInfo[],
  targetSort: number
): number | null {
  if (!bus || !bus.LatLng) return null

  const currentSort = bus.Current_Station_Sort

  // 计算剩余站数
  const remainingStations = stationList.filter(s =>
    s.Sort > currentSort && s.Sort <= targetSort
  ).length

  // 计算剩余距离
  let remainingDistance = 0
  for (const station of stationList) {
    if (station.Sort > currentSort && station.Sort <= targetSort) {
      remainingDistance += station.Distance || 0
    }
  }

  // 如果当前在两站之间，减去已走过的部分
  if (bus.IsArrive === 0 && bus.LatLng) {
    const currentStation = stationList.find(s => s.Sort === currentSort)
    if (currentStation) {
      const drivenDistance = haversineDistance(
        currentStation.LatLng.longitude,
        currentStation.LatLng.latitude,
        bus.LatLng.longitude,
        bus.LatLng.latitude
      )
      remainingDistance = Math.max(0, remainingDistance - drivenDistance)
    }
  }

  // 估算时间: 行驶时间 + 停靠时间
  const driveTime = remainingDistance / 500 // 平均速度500m/分钟
  const stopTime = remainingStations * 0.5  // 每站停靠0.5分钟

  return Math.ceil(driveTime + stopTime)
}
