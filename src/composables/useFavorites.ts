import { useStorage } from '@vueuse/core'
import { getLineList } from '../api/bus'
import type { LineInfo } from '../types/bus'

export interface FavoriteLine {
  lineId: number
  lineType: number
  lineName: string
  startStation: string
  endStation: string
}

const favoriteLines = useStorage<FavoriteLine[]>('favorites', [])

export function useFavorites() {
  function addFavorite(line: LineInfo) {
    const exists = favoriteLines.value.some(
      f => f.lineId === line.Line_Id && f.lineType === line.Line_Type
    )
    if (!exists) {
      favoriteLines.value.push({
        lineId: line.Line_Id,
        lineType: line.Line_Type,
        lineName: line.Line_Name,
        startStation: line.Start_Station_Name,
        endStation: line.End_Station_Name
      })
    }
  }

  function removeFavorite(line: FavoriteLine) {
    favoriteLines.value = favoriteLines.value.filter(
      f => !(f.lineId === line.lineId && f.lineType === line.lineType)
    )
  }

  function isFavorited(line: LineInfo): boolean {
    return favoriteLines.value.some(
      f => f.lineId === line.Line_Id && f.lineType === line.Line_Type
    )
  }

  function toggleFavorite(line: LineInfo) {
    if (isFavorited(line)) {
      removeFavorite({
        lineId: line.Line_Id,
        lineType: line.Line_Type,
        lineName: line.Line_Name,
        startStation: line.Start_Station_Name,
        endStation: line.End_Station_Name
      })
    } else {
      addFavorite(line)
    }
  }

  async function openFavorite(line: FavoriteLine) {
    try {
      const lines = await getLineList({ Line_Id: line.lineId, Line_Type: line.lineType })
      return lines.length > 0 ? lines[0] : null
    } catch (error) {
      console.error('加载线路失败:', error)
      return null
    }
  }

  return {
    favoriteLines,
    addFavorite,
    removeFavorite,
    isFavorited,
    toggleFavorite,
    openFavorite
  }
}
