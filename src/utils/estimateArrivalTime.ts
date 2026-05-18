import type { StationInfo, BusInfo } from "@/types/bus";
import { haversineDistance } from "./haversine";

function getSegmentDistance(
  stationList: StationInfo[],
  currentIndex: number,
  nextIndex: number,
) {
  const nextStation = stationList[nextIndex];
  if (!nextStation) return 0;

  if (typeof nextStation.Distance === "number" && nextStation.Distance > 0) {
    return nextStation.Distance;
  }

  const currentStation = stationList[currentIndex];
  if (!currentStation) return 0;

  return haversineDistance(
    currentStation.LatLng.longitude,
    currentStation.LatLng.latitude,
    nextStation.LatLng.longitude,
    nextStation.LatLng.latitude,
  );
}

/**
 * 估算公交到站时间（分钟）
 */
export function estimateArrivalTime(
  bus: BusInfo,
  stationList: StationInfo[],
  targetSort: number,
): number | null {
  if (!bus || !bus.LatLng) return null;

  const orderedStations = [...stationList].sort((a, b) => a.Sort - b.Sort);
  const currentIndex = orderedStations.findIndex(
    (station) => station.Sort === bus.Current_Station_Sort,
  );
  const targetIndex = orderedStations.findIndex(
    (station) => station.Sort === targetSort,
  );

  if (currentIndex === -1 || targetIndex === -1 || currentIndex > targetIndex) {
    return null;
  }

  let remainingDistance = 0;
  let stopTime = 0;

  for (let index = currentIndex + 1; index <= targetIndex; index += 1) {
    remainingDistance += getSegmentDistance(orderedStations, index - 1, index);
    stopTime += 0.5;
  }

  const currentStation = orderedStations[currentIndex];
  if (bus.IsArrive === 1) {
    stopTime += 0.5;
  } else if (currentStation) {
    const drivenDistance = haversineDistance(
      currentStation.LatLng.longitude,
      currentStation.LatLng.latitude,
      bus.LatLng.longitude,
      bus.LatLng.latitude,
    );
    remainingDistance = Math.max(0, remainingDistance - drivenDistance);
  }

  const driveTime = remainingDistance / 500;

  return Math.ceil(driveTime + stopTime);
}
