/**
 * 常州公交API封装 (TypeScript)
 * API文档: https://github.com/sunfkny/czx-bus-api
 */

import type {
  LineInfo,
  StationInfo,
  NearStation,
  BusInfo,
  ApiResponse
} from '@/types/bus'

const BASE_URL = 'https://nczxserv.czsmk.com:8444'

/**
 * 封装请求方法
 */
async function request<T>(path: string, params: Record<string, any> = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      url.searchParams.append(key, String(value))
    }
  })

  const response = await fetch(url.toString())
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const data: ApiResponse<T> = await response.json()
  if (data.resCode !== 10000) {
    throw new Error(data.resMsg || '请求失败')
  }
  return data.value
}

/**
 * 查询线路列表
 * @param params - 查询参数
 * @returns 线路列表
 */
export async function getLineList(params: {
  Line_Id?: number
  Line_Type?: number
  Line_Name?: string
} = {}): Promise<LineInfo[]> {
  return request<LineInfo[]>('/dgbus/xzBusLine/cz/getLineList', params)
}

/**
 * 查询线路站点
 * @param lineId - 线路ID
 * @param lineType - 线路类型 (1=下行, 2=上行, 3=环线)
 * @returns 站点列表
 */
export async function getListByLine(lineId: number, lineType: number): Promise<StationInfo[]> {
  return request<StationInfo[]>('/dgbus/xzBusLine/cz/getListByLine', {
    Line_Id: lineId,
    Line_Type: lineType
  })
}

/**
 * 附近站点搜索
 * @param lng - 经度
 * @param lat - 纬度
 * @param distance - 搜索半径(米)，默认500
 * @returns 附近站点列表
 */
export async function getNearList(lng: number, lat: number, distance: number = 500): Promise<NearStation[]> {
  return request<NearStation[]>('/dgbus/xzBusLine/cz/getNearList', {
    Lng: lng,
    Lat: lat,
    Distance: distance
  })
}

/**
 * 站点搜索
 * @param stationName - 站点名称关键词
 * @returns 站点列表
 */
export async function getStationList(stationName: string): Promise<NearStation[]> {
  return request<NearStation[]>('/dgbus/xzBusLine/cz/getStationList', {
    Station_Name: stationName
  })
}

/**
 * 实时公交车位置
 * @param lineId - 线路ID
 * @param lineType - 线路类型
 * @returns 实时车辆列表
 */
export async function getBusList(lineId: number, lineType: number): Promise<BusInfo[]> {
  return request<BusInfo[]>('/dgbus/xzBusLine/cz/getBusList', {
    Line_Id: lineId,
    Line_Type: lineType
  })
}

/**
 * 线路GPS轨迹
 * @param lineId - 线路ID
 * @param lineType - 线路类型
 * @returns GPS坐标串 "经度,纬度;经度,纬度;..."
 */
export async function getLineGPS(lineId: number, lineType: number): Promise<string> {
  return request<string>('/dgbus/xzBusLine/cz/getLineGPS', {
    Line_Id: lineId,
    Line_Type: lineType
  })
}

/**
 * 分段GPS轨迹
 * @param lineId - 线路ID
 * @param lineType - 线路类型
 * @returns 分段轨迹列表
 */
export async function getLineGPSList(lineId: number, lineType: number): Promise<{ Type: number; gps: string }[]> {
  return request<{ Type: number; gps: string }[]>('/dgbus/xzBusLine/cz/getLineGPSList', {
    Line_Id: lineId,
    Line_Type: lineType
  })
}

/**
 * 当日发车计划
 * @param lineId - 线路ID
 * @param lineType - 线路类型
 * @returns 发车计划列表
 */
export async function getDayPlanTime(lineId: number, lineType: number): Promise<{
  BusId: string
  Plan_Time: string
  driverName: string
  Run_Type: number
  Start_Station_Name: string
  startStationType: number
  End_Station_Name: string
}[]> {
  return request('/dgbus/xzBusLine/cz/getDayPlanTime', {
    Line_Id: lineId,
    Line_Type: lineType
  })
}
