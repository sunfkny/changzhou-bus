/**
 * 常州公交API类型定义
 * API Base URL: https://nczxserv.czsmk.com:8444
 */

// 线路类型枚举
export enum LineType {
  DOWN = 1, // 下行
  UP = 2, // 上行
  CIRCLE = 3, // 环线
}

// 经纬度坐标
export interface LatLng {
  longitude: number;
  latitude: number;
}

// 线路信息
export interface LineInfo {
  Line_Id: number;
  mainLineId: number;
  Line_Type: LineType;
  Line_Name: string;
  Start_Time: string;
  End_Time: string;
  Ticket: number;
  Mile: number;
  Start_Station_Name: string;
  End_Station_Name: string;
  Plan_Time: string | null;
  Station_Sort: number | null;
}

// 站点信息
export interface StationInfo {
  Line_Id: string;
  Line_Type: number;
  Station_Id: string;
  stationCode: string;
  Station_Name: string;
  Sort: number;
  gpsSort: number;
  Distance: number;
  LatLng: LatLng;
  Type: number;
}

// 附近站点
export interface NearStation {
  Station_Id: string;
  stationCode: string;
  Station_Name: string;
  LatLng: LatLng;
  Distance: number;
}

// 实时公交车
export interface BusInfo {
  BusId: string;
  productId: number;
  BusNo: string;
  Oil_Type: number;
  High: number;
  Speed: number;
  Direction: number;
  Line_Id: number;
  Line_Type: LineType;
  Current_Station_Sort: number;
  IsArrive: number;
  Run_Type: number;
  GpsTime: string | null;
  RecTime: string | null;
  StepGps: string | null;
  LatLng: LatLng | null;
}

// API响应
export interface ApiResponse<T> {
  resCode: number;
  resMsg: string;
  value: T;
}
