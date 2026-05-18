<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  watchEffect,
  onMounted,
  onUnmounted,
  nextTick,
  useTemplateRef,
} from "vue";
import { useRouter, useRoute } from "vue-router";
import {
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/vue-query";
import { useGeolocation } from "@vueuse/core";
import {
  getLineList,
  getListByLine,
  getBusList,
  getLineGPSList,
  getDayPlanTime,
} from "../api/bus";
import { LineType } from "../types/bus";
import type { StationInfo, BusInfo } from "../types/bus";
import { haversineDistance } from "../utils/haversine";
import { estimateArrivalTime } from "../utils/estimateArrivalTime";
import { wgs84ToGcj02 } from "../utils/gcj02";
import { useFavorites } from "../composables/useFavorites";
import Drawer from "../components/ui/drawer/Drawer.vue";
import DrawerContent from "../components/ui/drawer/DrawerContent.vue";
import DrawerHeader from "../components/ui/drawer/DrawerHeader.vue";
import DrawerTitle from "../components/ui/drawer/DrawerTitle.vue";

const props = defineProps<{
  lineId: string;
  lineType: string;
}>();

const router = useRouter();
const route = useRoute();
const queryClient = useQueryClient();
const { isFavorited, toggleFavorite } = useFavorites();

// --- Queries ---

const lineInfoQuery = useQuery({
  queryKey: computed(() => [
    "lineInfo",
    Number(props.lineId),
    Number(props.lineType),
  ]),
  queryFn: () =>
    getLineList({
      Line_Id: Number(props.lineId),
      Line_Type: Number(props.lineType),
    }),
  enabled: computed(() => !!props.lineId && !!props.lineType),
  placeholderData: keepPreviousData,
});

const stationsQuery = useQuery({
  queryKey: computed(() => [
    "stations",
    Number(props.lineId),
    Number(props.lineType),
  ]),
  queryFn: () => getListByLine(Number(props.lineId), Number(props.lineType)),
  enabled: lineInfoQuery.isSuccess,
  placeholderData: keepPreviousData,
});

const gpsQuery = useQuery({
  queryKey: computed(() => [
    "gps",
    Number(props.lineId),
    Number(props.lineType),
  ]),
  queryFn: () => getLineGPSList(Number(props.lineId), Number(props.lineType)),
  enabled: lineInfoQuery.isSuccess,
});

const scheduleQuery = useQuery({
  queryKey: computed(() => [
    "schedule",
    Number(props.lineId),
    Number(props.lineType),
  ]),
  queryFn: () => getDayPlanTime(Number(props.lineId), Number(props.lineType)),
  enabled: lineInfoQuery.isSuccess,
});

const busQuery = useQuery({
  queryKey: computed(() => [
    "buses",
    Number(props.lineId),
    Number(props.lineType),
  ]),
  queryFn: () => getBusList(Number(props.lineId), Number(props.lineType)),
  enabled: lineInfoQuery.isSuccess,
  refetchInterval: 5000,
});

// --- Map state ---

const mapRef = useTemplateRef("mapRef");
const stationListEl = useTemplateRef("stationListEl");

// AMap 实例和覆盖物不可响应式 — Vue Proxy 会破坏 AMap 内部状态
let map: AMap.Map | null = null;
let markers: AMap.Marker[] = [];
let busMarkers: AMap.Marker[] = [];
let userMarker: AMap.Marker | null = null;
let polylines: AMap.Polyline[] = [];
let stationMarkerRefs: Array<{ marker: AMap.Marker; station: StationInfo }> =
  [];

const mapReady = ref(false);
const hasDrawn = ref(false);
const hasLocated = ref(false);

const selectedStation = ref<StationInfo | null>(null);
const showStationList = ref(false);
const showSchedule = ref(false);
const selectedBusForInfo = ref<BusInfo | null>(null);

const { coords: geoCoords } = useGeolocation({ enableHighAccuracy: true });
const userPosition = computed(() => {
  if (geoCoords.value.latitude === 0 && geoCoords.value.longitude === 0)
    return null;
  const converted = wgs84ToGcj02(
    geoCoords.value.longitude,
    geoCoords.value.latitude,
  );
  return { lng: converted.lng, lat: converted.lat };
});

// --- Computed ---

const currentLine = computed(() => lineInfoQuery.data.value?.[0] ?? null);
const stations = computed(() => stationsQuery.data.value ?? []);
const buses = computed(() => busQuery.data.value ?? []);
const gpsData = computed(() => gpsQuery.data.value ?? []);
const schedule = computed(() => scheduleQuery.data.value ?? []);

const currentDirection = computed(() => {
  const s = stations.value;
  if (s.length === 0) return "--";
  return `${s[0].Station_Name} → ${s[s.length - 1].Station_Name}`;
});

const selectedStationBuses = computed(() => {
  if (!selectedStation.value) return [];

  const results: Array<{ bus: BusInfo; time: number }> = [];

  for (const bus of buses.value) {
    if (!bus.LatLng) continue;
    if (bus.Current_Station_Sort >= selectedStation.value.Sort) continue;
    const time = estimateArrivalTime(
      bus,
      stations.value,
      selectedStation.value.Sort,
    );
    if (time !== null && time < 60) {
      results.push({ bus, time });
    }
  }

  return results.sort((a, b) => a.time - b.time).slice(0, 5);
});

// --- Map helpers ---

function getStationMarkerContent(station: StationInfo) {
  const isTerminal =
    station.Sort === 1 || station.Sort === stations.value.length;
  const isSelected = selectedStation.value?.Station_Id === station.Station_Id;
  const hasBus = buses.value.some(
    (b) => b.Current_Station_Sort === station.Sort,
  );

  return {
    content: isTerminal
      ? `<div style="width:24px;height:24px;background:${isSelected ? "#F97316" : "#3B82F6"};color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.2)">${station.Sort}</div>`
      : `<div style="width:${isSelected ? 16 : 12}px;height:${isSelected ? 16 : 12}px;background:${isSelected ? "#F97316" : hasBus ? "#EF4444" : "white"};border:2px solid ${isSelected ? "#F97316" : hasBus ? "#EF4444" : "#3B82F6"};border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.15)"></div>`,
    offset: new window.AMap.Pixel(
      isTerminal ? -12 : isSelected ? -8 : -6,
      isTerminal ? -12 : isSelected ? -8 : -6,
    ),
  };
}

// --- Watchers ---

watch(selectedStation, () => {
  stationMarkerRefs.forEach(({ marker, station }) => {
    const { content, offset } = getStationMarkerContent(station);
    marker.setContent(content);
    marker.setOffset(offset);
  });
});

watchEffect(() => {
  const s = stations.value;
  const g = gpsData.value;
  if (s.length > 0 && g.length > 0 && mapReady.value) {
    drawMap(g);
  }
});

watchEffect(() => {
  void buses.value;
  if (mapReady.value) {
    updateBusMarkers();
  }
});

let autoSelected = false;
watch([() => props.lineId, () => props.lineType], () => {
  autoSelected = false;
});
watchEffect(() => {
  const s = stations.value;
  const p = userPosition.value;
  const queryStation = route.query.station as string | undefined;
  if (s.length === 0) return;

  // 有 URL query 时直接选中对应站点，不再自动选
  if (queryStation) {
    const found = s.find((st) => st.Station_Id === queryStation);
    if (found) {
      selectedStation.value = found;
    }
    return;
  }

  if (!autoSelected) {
    autoSelected = true;
    autoSelectNearestStation();
  } else if (p && selectedStation.value?.Station_Id === s[0]?.Station_Id) {
    // userPosition 延迟到达，重新选最近站点
    autoSelectNearestStation();
  }
});

watchEffect(() => {
  if (showStationList.value && selectedStation.value && stationListEl.value) {
    nextTick(() => {
      const el = stationListEl.value?.querySelector(
        `[data-station-id="${selectedStation.value?.Station_Id}"]`,
      );
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }
});

// --- Lifecycle ---

watch(userPosition, (pos) => {
  if (!pos || !map) return;
  const m = map;
  if (userMarker) m.remove(userMarker);
  userMarker = new window.AMap.Marker({
    position: [pos.lng, pos.lat],
    content: `<div style="width:20px;height:20px;background:#3B82F6;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(59,130,246,0.5)"></div>`,
    offset: new window.AMap.Pixel(-10, -10),
    zIndex: 300,
  });
  m.add(userMarker);
});

onMounted(async () => {
  await nextTick();
  await initMap();
});

onUnmounted(() => {
  queryClient.cancelQueries({
    queryKey: ["buses", Number(props.lineId), Number(props.lineType)],
  });
});

// --- Map ---

async function initMap() {
  if (map) return;

  await new Promise<void>((resolve) => {
    if (window.AMap) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src =
      "https://webapi.amap.com/maps?v=2.0&key=95a273969365aef06b70c7fa84375718&plugin=AMap.Geolocation";
    script.onload = () => resolve();
    document.head.appendChild(script);
  });

  await nextTick();
  if (!mapRef.value) return;

  map = new window.AMap.Map(mapRef.value, {
    mapStyle: "amap://styles/normal",
    viewMode: "2D",
  });
  mapReady.value = true;
}

function drawMap(gpsList: { Type: number; gps: string }[]) {
  if (!map) return;
  const m = map;

  markers.forEach((mk) => m.remove(mk));
  busMarkers.forEach((mk) => m.remove(mk));
  polylines.forEach((p) => m.remove(p));
  markers = [];
  busMarkers = [];
  polylines = [];
  stationMarkerRefs = [];

  gpsList.forEach((route) => {
    const path = route.gps
      .split(";")
      .map((p) => {
        const [lng, lat] = p.split(",").map(Number);
        return new window.AMap.LngLat(lng, lat);
      })
      .filter((p) => !isNaN(p.lng) && !isNaN(p.lat));

    const polyline = new window.AMap.Polyline({
      path,
      strokeColor: route.Type === 1 ? "#FF8853" : "#3B82F6",
      strokeWeight: 8,
      strokeOpacity: 1,
      lineJoin: "round",
      lineCap: "round",
      showDir: true,
      strokeStyle: route.Type === 1 ? "dashed" : "solid",
      strokeDasharray: [10, 5],
    });
    m.add(polyline);
    polylines.push(polyline);
  });

  stations.value.forEach((station) => {
    const { content, offset } = getStationMarkerContent(station);
    const marker = new window.AMap.Marker({
      position: [station.LatLng.longitude, station.LatLng.latitude],
      content,
      offset,
    });
    marker.on("click", () => onStationClick(station));
    m.add(marker);
    markers.push(marker);
    stationMarkerRefs.push({ marker, station });
  });

  if (!hasDrawn.value) {
    m.setFitView(undefined, true, [20, 20, 40, 20]);
    hasDrawn.value = true;
  }
}

function updateBusMarkers() {
  if (!map) return;
  const m = map;
  busMarkers.forEach((mk) => m.remove(mk));
  busMarkers = [];

  buses.value.forEach((bus) => {
    if (!bus.LatLng) return;
    const marker = new window.AMap.Marker({
      position: [bus.LatLng.longitude, bus.LatLng.latitude],
      content: `<div style="font-size:22px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3))">🚌</div>`,
      offset: new window.AMap.Pixel(-11, -11),
      zIndex: 200,
    });
    m.add(marker);
    busMarkers.push(marker);
  });
}

// --- Interactions ---

function selectStation(station: StationInfo) {
  selectedStation.value = station;
  router.replace({ query: { ...route.query, station: station.Station_Id } });
}

function onStationClick(station: StationInfo) {
  selectStation(station);
  map?.panTo([station.LatLng.longitude, station.LatLng.latitude]);
}

function selectStationFromList(station: StationInfo) {
  selectStation(station);
  showStationList.value = false;
  nextTick(() => {
    map?.panTo([station.LatLng.longitude, station.LatLng.latitude]);
  });
}

function autoSelectNearestStation() {
  if (stations.value.length === 0) return;
  if (userPosition.value) {
    let nearest: StationInfo | null = null;
    let minDist = Infinity;
    for (const s of stations.value) {
      const d = haversineDistance(
        userPosition.value.lng,
        userPosition.value.lat,
        s.LatLng.longitude,
        s.LatLng.latitude,
      );
      if (d < minDist) {
        minDist = d;
        nearest = s;
      }
    }
    if (nearest && minDist < 2000) {
      selectedStation.value = nearest;
      return;
    }
  }
  selectedStation.value = stations.value[0];
}

function locateUser() {
  if (!map) return;
  const m = map;
  if (!hasLocated.value && userPosition.value) {
    m.setCenter([userPosition.value.lng, userPosition.value.lat]);
    m.setZoom(16, false);
    hasLocated.value = true;
  } else {
    try {
      m.setFitView(undefined, false, [20, 20, 40, 20]);
    } catch (e) {
      console.error(e);
    }
    hasLocated.value = false;
  }
}

function goBack() {
  router.push("/");
}

async function switchDirection() {
  if (!currentLine.value) return;
  const newType =
    currentLine.value.Line_Type === LineType.DOWN ? LineType.UP : LineType.DOWN;
  const lines = await getLineList({
    Line_Id: currentLine.value.Line_Id,
    Line_Type: newType,
  });
  if (lines.length > 0) {
    showStationList.value = false;
    showSchedule.value = false;
    hasLocated.value = false;
    router.replace({
      name: "map",
      params: { lineId: lines[0].Line_Id, lineType: lines[0].Line_Type },
    });
  }
}
</script>

<template>
  <div class="flex-1 flex flex-col">
    <header class="bg-white shadow-sm z-40 flex-shrink-0">
      <div class="px-4 py-3 flex items-center gap-3">
        <button
          class="p-2 -ml-2 active:bg-gray-100 rounded-full"
          @click="goBack"
        >
          <svg
            class="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <div class="flex-1 min-w-0">
          <div class="font-medium text-gray-800">
            {{ currentLine?.Line_Name }}
          </div>
          <div class="text-xs text-gray-500 truncate">
            {{ currentDirection }}
          </div>
        </div>
        <button
          v-show="currentLine"
          class="p-2 active:bg-gray-100 rounded-full"
          @click="currentLine && toggleFavorite(currentLine)"
        >
          <svg
            class="w-6 h-6"
            :class="
              currentLine && isFavorited(currentLine)
                ? 'text-yellow-400'
                : 'text-gray-400'
            "
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            />
          </svg>
        </button>
        <button
          v-show="currentLine"
          class="px-3 py-1.5 bg-blue-50 text-blue-500 rounded-full text-sm font-medium active:bg-blue-100"
          @click="switchDirection"
        >
          {{ currentLine?.Line_Type === LineType.DOWN ? "上行" : "下行" }}
        </button>
      </div>
    </header>

    <!-- 地图 -->
    <div class="flex-1 min-h-0 relative">
      <div ref="mapRef" class="w-full h-full"></div>

      <!-- 定位按钮 -->
      <button
        class="absolute bottom-4 right-4 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center z-20 active:bg-gray-100"
        @click="locateUser"
      >
        <svg
          class="w-6 h-6 text-blue-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>

      <!-- 公交车信息弹窗 -->
      <Transition name="slide-up">
        <div
          v-if="selectedBusForInfo"
          class="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-lg z-30 p-4"
        >
          <div class="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3"></div>
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white"
              >
                🚌
              </div>
              <div>
                <div class="font-medium text-gray-800">
                  {{ selectedBusForInfo?.BusNo }}
                </div>
                <div class="text-xs text-gray-500">
                  {{ selectedBusForInfo?.Oil_Type === 1 ? "新能源" : "燃油" }}
                </div>
              </div>
            </div>
            <button
              class="p-1 active:bg-gray-100 rounded-full"
              @click="selectedBusForInfo = null"
            >
              <svg
                class="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div class="bg-gray-50 rounded-xl p-3">
              <div class="text-gray-500 text-xs mb-1">当前站</div>
              <div class="font-medium text-gray-800">
                {{
                  stations.find(
                    (s) => s.Sort === selectedBusForInfo?.Current_Station_Sort,
                  )?.Station_Name || "-"
                }}
              </div>
            </div>
            <div class="bg-gray-50 rounded-xl p-3">
              <div class="text-gray-500 text-xs mb-1">状态</div>
              <div
                class="font-medium"
                :class="
                  selectedBusForInfo?.IsArrive === 1
                    ? 'text-green-600'
                    : 'text-orange-500'
                "
              >
                {{ selectedBusForInfo?.IsArrive === 1 ? "已到站" : "行驶中" }}
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <!-- 底部面板 -->
    <div v-if="selectedStation" class="flex-shrink-0 bg-white shadow-lg z-20">
      <!-- 到站信息 -->
      <div class="p-4">
        <div class="mb-1">
          <div class="font-medium text-gray-800">
            {{ selectedStation.Station_Name }}
          </div>
        </div>
        <div class="text-xs text-gray-400 mb-3">
          第{{ selectedStation.Sort }}站
        </div>

        <div v-if="selectedStationBuses.length > 0" class="space-y-2">
          <div
            v-for="item in selectedStationBuses"
            :key="`${item.bus.BusId}-${item.bus.Current_Station_Sort}`"
            class="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs"
              >
                🚌
              </div>
              <div>
                <div class="text-sm font-medium text-gray-800">
                  {{ item.bus.BusNo }}
                </div>
                <div class="text-xs text-gray-500">
                  还有{{
                    item.bus.Current_Station_Sort - selectedStation.Sort + 1
                  }}站
                </div>
              </div>
            </div>
            <div class="text-right">
              <div class="text-lg font-bold text-orange-500">
                约{{ item.time }}分钟
              </div>
            </div>
          </div>
        </div>
        <div v-else class="text-center text-gray-400 py-3 text-sm">
          暂无车辆
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="flex border-t border-gray-100">
        <button
          class="flex-1 py-3 flex items-center justify-center gap-1.5 text-sm text-gray-600 active:bg-gray-50"
          @click="showStationList = true"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
          </svg>
          全部站点
        </button>
        <div class="w-px bg-gray-100"></div>
        <button
          class="flex-1 py-3 flex items-center justify-center gap-1.5 text-sm text-gray-600 active:bg-gray-50"
          @click="showSchedule = true"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          发车时刻表
        </button>
      </div>
    </div>

    <!-- 全部站点 Drawer -->
    <Drawer v-model:open="showStationList">
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>全部站点</DrawerTitle>
        </DrawerHeader>
        <div
          ref="stationListEl"
          class="overflow-y-auto px-4 pb-6"
          style="max-height: 60vh"
        >
          <div
            v-for="station in stations"
            :key="station.Station_Id"
            :data-station-id="station.Station_Id"
            class="flex items-center gap-3 py-3 border-b border-gray-50"
            :class="{
              'bg-orange-50 -mx-4 px-4':
                selectedStation?.Station_Id === station.Station_Id,
            }"
            @click="selectStationFromList(station)"
          >
            <div
              class="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0"
              :class="
                selectedStation?.Station_Id === station.Station_Id
                  ? 'bg-orange-500 text-white'
                  : station.Sort === 1 || station.Sort === stations.length
                    ? 'bg-blue-500 text-white'
                    : 'border-2 border-blue-400 text-blue-500'
              "
            >
              {{ station.Sort }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm text-gray-800 truncate">
                {{ station.Station_Name }}
              </div>
            </div>
            <div class="flex items-center gap-1.5 flex-shrink-0">
              <div
                v-for="bus in buses.filter(
                  (b) => b.Current_Station_Sort === station.Sort,
                )"
                :key="bus.BusId"
                class="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs cursor-pointer active:bg-blue-600"
                @click.stop="selectedBusForInfo = bus"
              >
                🚌
              </div>
              <div
                v-if="
                  buses.some((b) => b.Current_Station_Sort === station.Sort)
                "
                class="w-2 h-2 bg-red-500 rounded-full"
              ></div>
              <div
                v-if="
                  buses.some(
                    (b) =>
                      b.Current_Station_Sort < station.Sort &&
                      b.Current_Station_Sort >
                        (stations.find((s) => s.Sort === station.Sort - 1)
                          ?.Sort ?? 0),
                  )
                "
                class="text-xs text-orange-500 font-medium"
              >
                {{
                  buses.filter(
                    (b) =>
                      b.Current_Station_Sort < station.Sort &&
                      b.Current_Station_Sort >
                        (stations.find((s) => s.Sort === station.Sort - 1)
                          ?.Sort ?? 0),
                  ).length
                }}辆途中
              </div>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>

    <!-- 发车时刻表 Drawer -->
    <Drawer v-model:open="showSchedule">
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>发车时刻表</DrawerTitle>
        </DrawerHeader>
        <div class="overflow-y-auto px-4 pb-6" style="max-height: 60vh">
          <div
            v-if="schedule.length === 0"
            class="text-center text-gray-400 py-8 text-sm"
          >
            暂无发车数据
          </div>
          <div
            v-for="item in schedule"
            :key="item.BusId"
            class="flex items-center gap-3 py-3 border-b border-gray-50"
          >
            <div
              class="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0"
            >
              <svg
                class="w-4 h-4 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-gray-800">
                {{ item.Plan_Time }}
              </div>
              <div class="text-xs text-gray-400 truncate">
                {{ item.Start_Station_Name }} → {{ item.End_Station_Name }}
              </div>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  </div>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
